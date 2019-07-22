import React, { useState } from 'react';
import produce from 'immer';
import './App.css';

export enum Space {
  HiddenBomb = "@",
  EmptySpace = "^",
  ExplodedBomb = "X",
  ClickedSpace = '#'
}
type position = [number, number];
// Array containing **relative** indices of the cells around some cell
const relativeNeighbors: position[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
]

export function bombClass(input: Space) {
  if (input === Space.HiddenBomb || input === Space.EmptySpace) {
    return '';
  } else if (input === Space.ExplodedBomb) {
    return 'bomb';
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
  return relativeNeighbors.reduce((count, relativePos) => {
    // Turn the relative position absolute by adding it to current cell index
    const rowIdToCheck = rowIndex + relativePos[1];
    const cellIdToCheck = cellIndex + relativePos[0];
    if (rowIdToCheck < 0 || rowIdToCheck >= matrix.length) {
      // If it is outside bounds, don't compare, and just return count
      return count;
    }
    // Now space is guaranteed to be within bounds
    const space = matrix[rowIdToCheck][cellIdToCheck];
    if (space === Space.HiddenBomb || space === Space.ExplodedBomb) {
      // Hidden bombs and exploded ones are counted as 1;
      return count + 1;
    }
    // If this code is reached, it's like an else - where the currently accumulated count is retained
    return count;
  }, 0);
}

function isCellExploded(cell: Space) {
  if (cell === Space.ExplodedBomb) {
    return true;
  } else {
    return false;
  }
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

export function stateAfterClick(prevState: Space[][], cellClicked: number, rowClicked: number): Space[][] {
  // Change state of the clicked row to switch color
  prevState[rowClicked][cellClicked] = Space.ExplodedBomb;
  return prevState;
}

const App: React.FC = () => {
  const width = 5;
  const height = 4;

  const [ data, setData ] = useState(generateRandomFields(width, height));

  function fieldClicked(rowClicked: number = 0, cellClicked: number = 0) {
    // When field is clicked, we check how would that affect the state,
    // and update it in react, so that react would render it
    setData(JSON.parse(JSON.stringify(stateAfterClick(data, cellClicked, rowClicked))));
  }

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
