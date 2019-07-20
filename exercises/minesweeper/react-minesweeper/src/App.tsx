import React, { useState } from 'react';
import './App.css';

enum Space {
  HiddenBomb,
  EmptySpace,
  ExplodedBomb,
  ClickedSpace
}

type position = [number, number];
const relativeNeighbors: position[] = [
  [   -1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
]

function bombClass(input: Space) {
  if (input === Space.HiddenBomb || input === Space.EmptySpace) {
    return '';
  } else if (input === Space.ExplodedBomb) {
    return 'bomb';
  } else {
    return 'open';
  }
}

function generateRandomFields(width: number, height: number): Space[][] {
  return Array(height).fill(null)
    .map(() => Array(width).fill(null)
      .map(() => Math.random() > 0.9 ? Space.HiddenBomb : Space.EmptySpace));
}

function nearbyBombCount(
  rowIndex: number,
  cellIndex: number,
  matrix: Array<Array<Space>>
) {
  return relativeNeighbors.reduce((count, relativePos) => {
    const rowIdToCheck = rowIndex + relativePos[1];
    const cellIdToCheck = cellIndex + relativePos[0];
    if (rowIdToCheck < 0 || rowIdToCheck >= matrix.length) {
      return count;
    }
    const space = matrix[rowIdToCheck][cellIdToCheck];
    if (space === Space.HiddenBomb || space === Space.ExplodedBomb) {
      return count + 1;
    }
    return count;
  }, 0);
}

function stateAfterClick(prevState: Space[][], cellClicked: number, rowClicked: number): Space[][] {
  // Change state of the clicked row to switch color
  const nextState = prevState.map((row, rowIndex) => 
    row.map((cell, cellIndex) => {
      if (rowIndex === rowClicked && cellIndex === cellClicked) {
        if (cell === Space.HiddenBomb || cell === Space.ExplodedBomb) {
          return Space.ExplodedBomb;
        } else {
          return Space.ClickedSpace;
        }
      } else {
        return cell;
      }
    }));
  // Check if cell clicked has 0 neighbor bombs
  if (
    nextState[rowClicked][cellClicked] === Space.ClickedSpace &&
    nearbyBombCount(rowClicked, cellClicked, nextState) === 0
  ) {
    // Go through all neighbors, and click them all
    return relativeNeighbors.reduce((state: Space[][], neighbor: position) => {
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
  const width = 5;
  const height = 4;

  const [ data, setData ] = useState(generateRandomFields(width, height));

  function fieldClicked(rowClicked: number = 0, cellClicked: number = 0) {
    setData(stateAfterClick(data, cellClicked, rowClicked));
  }

  return (
    <div>
      <h1>MINESWEEPER!!</h1>
      <div id="table-container">
        <table>
          { data.map(((row, rowIndex) => <tr>
            { row.map((cell, cellIndex) => 
              <td
                onClick={() => fieldClicked(rowIndex, cellIndex)}
                className={bombClass(cell)}
              >
                { cell === Space.ClickedSpace ? nearbyBombCount(rowIndex, cellIndex, data) : "" }
              </td>
            ) }
          </tr>)) }
        </table>
      </div>
    </div>
  );
}

export default App;
