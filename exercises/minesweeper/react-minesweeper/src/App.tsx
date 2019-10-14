import React, { useState } from 'react';
import produce from 'immer';
import './App.css';

const assumedBombDensity = 0.2;

export enum Space {
  HiddenBomb = "Hidden",
  EmptySpace = "Empty",
  ExplodedBomb = "Exploded",
  ClickedSpace = "Clicked",
  MarkedAsBomb = "Marked"
}
type VisibleCell = Space.ExplodedBomb | Space.EmptySpace | Space.MarkedAsBomb | 'SuggestedClick' | number;
type VisibleState = VisibleCell[][];

/**
 * [ column, row ]
 */
type Position = [number, number];
// Array containing **relative** indices of the cells around some cell
const relativeNeighbors: Position[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
];

function relativeNeighborContent<T>(data: T[][], col: number, row: number): { content: T, col: number, row: number }[] {
  return relativeNeighbors.map(([ rCol, rRow ]) => {
    const absCol = col + rCol;
    const absRow = row + rRow;
    if (absRow < 0 || absRow >= data.length) return null;
    if (absCol < 0 || absCol >= data[absRow].length) return null;
    return { content: data[absRow][absCol], col: absCol, row: absRow };
  }).filter((x): x is { content: T, col: number, row: number } => x !== null);
}

export function bombClass(input: VisibleCell) {
  if (input === Space.EmptySpace) {
    return '';
  } else if (input === Space.ExplodedBomb) {
    return 'bomb';
  } else if (input === Space.MarkedAsBomb) {
    return 'markedBomb';
  } else if (input === 'SuggestedClick') {
    return 'nextClick'
  } else {
    return 'open';
  }
}

export function generateRandomFields(width: number, height: number): Space[][] {
  return Array(height).fill(null)
    .map(() => Array(width).fill(null)
      .map(() => Math.random() > 0.9 ? Space.HiddenBomb : Space.EmptySpace));
}

export function nearbyBombCount(
  rowIndex: number,
  cellIndex: number,
  matrix: Array<Array<Space>>
) {
  // Iterate through all neighbors of this cell, and count bombs
  return relativeNeighborContent(matrix, cellIndex, rowIndex).reduce((count, { content }) =>
    content === Space.HiddenBomb || content === Space.ExplodedBomb ? count + 1 : count
  , 0);
}

function stateToVisible(data: Space[][]): VisibleState {
  return data.map((row, rowIndex) => row.map((cell, cellIndex) =>
    cell === Space.HiddenBomb || cell == Space.EmptySpace ? Space.EmptySpace :
    cell === Space.ExplodedBomb ? cell :
    cell === Space.MarkedAsBomb ? cell :
    nearbyBombCount(rowIndex, cellIndex, data)
  ));
}

/**
 * Returns boolean value whether any of the cells inside data has type ExplodedBomb
 * @param data The matrix of all the cells in this minesweeper
 */
function isGameOver(data: Space[][]) {
  return data.some((row) =>
    row.some(cell => cell === Space.ExplodedBomb)
  );
}

export function isGameWon(data: Space[][]): boolean {
  return data.every(row => row.every(cell => cell !== Space.EmptySpace)) &&
    !isGameOver(data);
}

/**
 * Returns the probability of hitting a bomb when clicking any unclicked neighbor of a given cell
 * @param data 
 * @param row 
 * @param column 
 */
function neighborBombProbability(data: VisibleState, row: number, column: number): number | null {
  const cell = data[row][column];
  if (typeof cell !== 'number') {
    return null; // TODO: Maybe something else?
  }
  const neighbors = relativeNeighborContent(data, column, row);
  const unTouchedCount = neighbors.filter(({ content }) => content === Space.EmptySpace).length;
  const knownNeighborBombs = neighbors.filter(({ content }) => content === Space.MarkedAsBomb).length;
  return unTouchedCount / (cell - knownNeighborBombs);
}

function cellBombProbability(data: VisibleState, neighborProbabilities: Array<Array<number | null>>, row: number, column: number): number {
  const cell = data[row][column];
  if (cell === Space.ExplodedBomb || cell === Space.MarkedAsBomb) {
    return 1;
  } else if (typeof cell === 'number') {
    return 0;
  }
  const neighbors = relativeNeighborContent(neighborProbabilities, column, row)
    .filter((x): x is { content: number, row: number, col: number } => x.content !== null);
  if (!neighbors.length) {
    return assumedBombDensity;
  }
  return 1 - neighbors.reduce((acc, { content: neighbor }) => (1 - neighbor) * acc, assumedBombDensity)
}

function nextClickableCells(data: VisibleState): Position[] {
  const neighborProbabilities = data.map((row, rowIndex) => row.map((cell, cellIndex) => neighborBombProbability(data, rowIndex, cellIndex)));
  const cellProbabilities = data.map((row, rowIndex) => row.map((cell, cellIndex) => cellBombProbability(data, neighborProbabilities, rowIndex, cellIndex)));
  // const groups = cellProbabilities.map
  return [[0, 0]];
}

function visibleStateWithSuggestions(data: VisibleState): VisibleState {
  return produce(data, draft => {
    for (const [ cell, row ] of nextClickableCells(data)) {
      draft[row][cell] = 'SuggestedClick';
    }
  });
}

function stateAfterClick(prevState: Space[][], cellClicked: number, rowClicked: number): Space[][] {
  // Change state of the clicked row to switch color
  const nextState = produce(prevState, draft => {
    const cell = prevState[rowClicked][cellClicked];
    draft[rowClicked][cellClicked] = (cell === Space.HiddenBomb || cell === Space.ExplodedBomb) ?
      Space.ExplodedBomb : Space.ClickedSpace
  });
  // const nextState = prevState.map((row, rowIndex) => 
  //   row.map((cell, cellIndex) => {
  //     // This function is called for **EVERY** cell in the matrix
  //     if (rowIndex === rowClicked && cellIndex === cellClicked) {
  //       // If we're in this block, it means we're looking at the cell that was clicked
  //       if (cell === Space.HiddenBomb || cell === Space.ExplodedBomb) {
  //         return Space.ExplodedBomb;
  //       } else {
  //         return Space.ClickedSpace;
  //       }
  //     } else {
  //       // Cells that were not clicked are not changed, so we return the same element in the map call
  //       return cell;
  //     }
  //   }));

  // Check if cell clicked has 0 neighbor bombs
  if (
    nextState[rowClicked][cellClicked] === Space.ClickedSpace &&
    nearbyBombCount(rowClicked, cellClicked, nextState) === 0
  ) {
    // Go through all neighbors, and click them all
    return relativeNeighbors.reduce((state: Space[][], neighbor: Position) => {
      const cellId = cellClicked + neighbor[0];
      const rowId = rowClicked + neighbor[1];

      // Check if neighbor is within bounds of field
      if (cellId < 0 || rowId < 0 || rowId >= state.length || cellId >= state[0].length) {
        // Don't click anything outside bounds
        return state;
      }
      const spaceClicked = state[rowId][cellId];
      if (spaceClicked !== Space.EmptySpace) {
        // Don't click on spaces that have already been clicked
        return state;
      }
      return stateAfterClick(state, cellId, rowId);
    }, nextState);
  } else {
    // Since number on cell > 0, just return the state
    // dont click more cells
    return nextState;
  }
}

const App: React.FC = () => {
  const width = 10;
  const height = 10;

  const [ data, setData ] = useState(generateRandomFields(width, height));

  function fieldClicked(rowClicked: number = 0, cellClicked: number = 0) {
    // When field is clicked, we check how would that affect the state,
    // and update it in react, so that react would render it
    setData(stateAfterClick(data, cellClicked, rowClicked));
  }

  const visibleSpaces = stateToVisible(data);
  const visibleAndSuggested = visibleStateWithSuggestions(visibleSpaces);

  return (
    <div>
      <h1>MINESWEEPER!!</h1>
      <div id="table-container">
      {
          isGameOver(data) ? <div>You lose</div> : null
        }
        {
          isGameWon(data) ? <div>You win</div> : null
        }
          <table>
            { visibleAndSuggested.map(((row, rowIndex) => <tr>
              { row.map((cell, cellIndex) => 
                <td
                  onClick={() => fieldClicked(rowIndex, cellIndex)}
                  className={bombClass(cell)}
                >
                  { typeof cell === 'number' ? cell : '' }
                </td>
              ) }
            </tr>)) }
          </table>
      </div>
    </div>
  );
}

export default App;
