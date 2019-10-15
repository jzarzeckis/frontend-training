import React, { useState } from 'react';
import produce from 'immer';
import './App.css';
import { groupBy } from 'lodash';

const assumedBombDensity = 0.15;

const actualBombDensity = 0.15;

export enum Space {
  HiddenBomb = "Hidden",
  EmptySpace = "Empty",
  ExplodedBomb = "Exploded",
  ClickedSpace = "Clicked",
  MarkedAsBomb = "Marked"
}
type VisibleCell = Space.ExplodedBomb | Space.EmptySpace | Space.MarkedAsBomb | 'SuggestedClick' | 'KnownSafeSpace' | number;
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
  return relativeNeighbors.map(([rCol, rRow]) => {
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
    return 'nextClick';
  } else if (input === 'KnownSafeSpace') {
    return 'safeSpace';
  } else {
    return 'open';
  }
}

export function generateRandomFields(width: number, height: number): Space[][] {
  return Array(height).fill(null)
    .map(() => Array(width).fill(null)
      .map(() => Math.random() < actualBombDensity ? Space.HiddenBomb : Space.EmptySpace));
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
    cell === Space.HiddenBomb || cell === Space.EmptySpace ? Space.EmptySpace :
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
 * Returns the probability of hitting a bomb when clicking any (unclicked AND unmarked as a mine AND unmarked as a safe space)
 * neighbor of a given cell.
 * Returns null for unclicked cells - as they don't yield any new information about probabilities
 * @param data The matrix of the visible cells
 * @param row 
 * @param column 
 */
function neighborBombProbability(data: VisibleState, row: number, column: number): number | null {
  const cell = data[row][column];
  if (typeof cell !== 'number') {
    return null; // TODO: Maybe something else?
  }
  const neighbors = relativeNeighborContent(data, column, row);
  const unTouchedCount = neighbors.filter(({ content }) => content === Space.EmptySpace || content === 'SuggestedClick').length;
  const knownNeighborBombs = neighbors.filter(({ content }) => content === Space.MarkedAsBomb).length;
  return (cell - knownNeighborBombs) / unTouchedCount;
}

/**
 * Deduces the probability that there is a bomb in a given undiscovered field
 * For example - 
 * if there is a neighbor with a number 1, and the questioned cell is it's only undiscovered neighbor,
 * and there were no other bombs around the questioned node, then it's 100% clear that the questioned cell has a bomb
 * @param data 
 * @param neighborProbabilities 
 * @param row 
 * @param column 
 */
function cellBombProbability(data: VisibleState, neighborProbabilities: Array<Array<number | null>>, row: number, column: number): number {
  const cell = data[row][column];
  if (cell === Space.ExplodedBomb || cell === Space.MarkedAsBomb) {
    return 1;
  } else if (typeof cell === 'number' || cell === 'KnownSafeSpace') {
    return 0;
  }
  const neighbors = relativeNeighborContent(neighborProbabilities, column, row)
    .filter((x): x is { content: number, row: number, col: number } => x.content !== null)
    .map(({ content }) => content);
  if (!neighbors.length) {
    return assumedBombDensity;
  }
  if (neighbors.includes(0)) {
    return 0;
  }
  if (neighbors.includes(1)) {
    return 1;
  }
  return neighbors.reduce((acc, nProb) =>
    acc + nProb / neighbors.length
    , 0);
}

function cellPropsToPosition({ cellIndex, rowIndex }: { cellIndex: number, rowIndex: number }): Position {
  return [cellIndex, rowIndex];
}

function nextSuggestedCells(data: VisibleState): VisibleState {
  const neighborProbabilities = data.map((row, rowIndex) => row.map((cell, cellIndex) => neighborBombProbability(data, rowIndex, cellIndex)));
  const cellProbabilities = data.flatMap((row, rowIndex) =>
    row.map((cell, cellIndex) =>
      ({ value: cell, prob: cellBombProbability(data, neighborProbabilities, rowIndex, cellIndex), rowIndex, cellIndex })));
  const newBombsDisvovered = cellProbabilities.filter(({ value, prob }) => (value === Space.EmptySpace || value === 'SuggestedClick') && prob === 1);
  const newSafeSpotsDiscovered = cellProbabilities.filter(({ value, prob }) => (value === Space.EmptySpace || value === 'SuggestedClick') && prob === 0);
  const otherClickableCells = cellProbabilities.filter(({ value, prob }) => (value === Space.EmptySpace || value === 'SuggestedClick') && prob !== 0 && prob !== 1);
  const groups = groupBy(otherClickableCells, ({ prob }) => prob);
  // Cells having the lowest probability of containing a bomb
  const lowest = otherClickableCells.length > 0 ? groups[Math.min(...Object.keys(groups).map(Number))] : [];
  const nextState = applySuggestions(
    data,
    newBombsDisvovered.map(cellPropsToPosition),
    newSafeSpotsDiscovered.map(cellPropsToPosition),
    lowest.map(cellPropsToPosition)
  );
  if (newBombsDisvovered.length === 0 && newSafeSpotsDiscovered.length === 0) {
    return nextState;
  }
  // Since new spots discovered affect the probabilities, the calulation needs to be repeated
  return nextSuggestedCells(nextState);
}

function applySuggestions(data: VisibleState, bombsToMark: Position[], safeSpotsToMark: Position[], lowProbabilities: Position[]): VisibleState {
  return produce(data, draft => {
    for (const [cell, row] of bombsToMark) {
      draft[row][cell] = Space.MarkedAsBomb;
    }
    for (const [cell, row] of safeSpotsToMark) {
      draft[row][cell] = 'KnownSafeSpace';
    }
    for (const [cell, row] of lowProbabilities) {
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

  // Check if cell clicked has 0 neighbor bombs
  if (
    nextState[rowClicked][cellClicked] === Space.ClickedSpace &&
    nearbyBombCount(rowClicked, cellClicked, nextState) === 0
  ) {
    // Go through all neighbors, and click them all
    return relativeNeighborContent(prevState, cellClicked, rowClicked).reduce((state, { content, col, row }) =>
      content !== Space.EmptySpace ? state : stateAfterClick(state, col, row)
      , nextState);
  } else {
    // Since number on cell > 0, just return the state
    // dont click more cells
    return nextState;
  }
}

const App: React.FC = () => {
  const width = 10;
  const height = 10;

  const [data, setData] = useState(generateRandomFields(width, height));

  function fieldClicked(rowClicked: number = 0, cellClicked: number = 0) {
    // When field is clicked, we check how would that affect the state,
    // and update it in react, so that react would render it
    setData(stateAfterClick(data, cellClicked, rowClicked));
  }


  const visibleSpaces = stateToVisible(data);
  const visibleAndSuggested = nextSuggestedCells(visibleSpaces);
  // console.log('probabilities', data.map((row, rowIndex) => row.map((cell, cellIndex) => neighborBombProbability(visibleAndSuggested, rowIndex, cellIndex))));

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
          {visibleAndSuggested.map(((row, rowIndex) => <tr>
            {row.map((cell, cellIndex) =>
              <td
                onClick={() => fieldClicked(rowIndex, cellIndex)}
                className={bombClass(cell)}
              >
                {typeof cell === 'number' ? cell : ''}
              </td>
            )}
          </tr>))}
        </table>
        <h3>Legend</h3>
        <table>
          <tr>{
            [Space.ExplodedBomb, Space.EmptySpace, Space.MarkedAsBomb, 'SuggestedClick', 'KnownSafeSpace'].map(x =>
              <td className={bombClass(x as any)}>{x}</td>
            )
          }</tr>
        </table>
      </div>
    </div>
  );
}

export default App;
