import React, { useReducer, useEffect, useState } from 'react';
import produce from 'immer';
import './App.css';
import { groupBy, sample } from 'lodash';
import { tsImportEqualsDeclaration } from '@babel/types';

const assumedBombDensity = 0.19;

const actualBombDensity = 0.15;

const width = 80;
const height = 40;

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
    acc + nProb
    , 0) / neighbors.length;
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

function clickReducer(state: Space[][], action: Position | 'RESTART') {
  if (action === 'RESTART') {
    return generateRandomFields(width, height);
  }
  const [col, row] = action;
  return stateAfterClick(state, col, row)
}

type PossiblePhase = 'WAITING' | 'PLAYING' | 'LOST' | 'WON';

function phaseReducer(state: PossiblePhase, action: 'LOSE' | 'WIN' | 'START'): PossiblePhase {
  if (action === 'START') {
    return 'PLAYING';
  } else if (action === 'LOSE') {
    return 'LOST';
  } else {
    return 'WON';
  }
}

function areRowsEqual(prev: VisibleCell[], next: VisibleCell[]) {
  for (let i = 0; i < next.length; i++) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
}

const Cell = React.memo<{
  rowIndex: number,
  cellIndex: number,
  cell: VisibleCell,
  dispatch: React.Dispatch<Position>,
}>(function Cell({ rowIndex, cellIndex, cell, dispatch }) {
  return <td
    onClick={() => dispatch([cellIndex, rowIndex])}
    className={bombClass(cell)}
  >
    {typeof cell === 'number' ? cell : ''}
  </td>
}, function ({ cell: prevCell }, { cell: nextCell }) {
  return prevCell === nextCell;
});

const Row = React.memo<{
  row: VisibleCell[],
  index: number,
  dispatch: React.Dispatch<Position>
}>(function Row({ row, index, dispatch }) {
  return <tr>
    {row.map((cell, cellIndex) => <Cell
      key={`c-${index}-${cellIndex}`}
      rowIndex={index}
      cellIndex={cellIndex}
      cell={cell}
      dispatch={dispatch}
    />)}
  </tr>
}, function ({ row: prevRow }, { row: nextRow }) {
  return areRowsEqual(prevRow, nextRow);
});

function decideNextClick(state: VisibleState): Position {
  const groups = groupBy(state.flatMap((row, rowIndex) =>
    row.map((cell, cellIndex): { c: VisibleCell, p: Position } =>
      ({ c: cell, p: [cellIndex, rowIndex] })))
    , i => i.c);

  const { KnownSafeSpace, SuggestedClick } = groups;

  const used = KnownSafeSpace ? KnownSafeSpace : SuggestedClick;
  return sample(used)!.p;
}

const initialState = generateRandomFields(width, height);

function charToVisibleCell(c: string): VisibleCell {
  return c === '□' ? Space.EmptySpace :
    c === '*' ? Space.ExplodedBomb :
      parseInt(c)
}

function bombDensityInVisibleCells(state: VisibleState): number {
  const consideredCells = state.flatMap(row => row.filter(cell => typeof cell === 'number' || cell === Space.MarkedAsBomb || cell === Space.ExplodedBomb));
  return consideredCells.filter(c => c === Space.MarkedAsBomb || c === Space.ExplodedBomb).length / consideredCells.length;
}

class QuickSolver {
  public state: VisibleState = [[]];
  private isRunning: boolean = true;
  update(
    state: VisibleState,
    ws: WebSocket
  ) {
    this.state = state;
    setTimeout(() => {
      if (this.isRunning) {
        this.clickCell(decideNextClick(nextSuggestedCells(state)), ws)
      }
    }, 10);
  }
  private clickCell([col, row]: Position, ws: WebSocket) {
    ws.send(`open ${col} ${row}`);
    ws.send('map');
  }
  stop() {
    this.isRunning = false;
  }
  start() {
    this.isRunning = true;
  }
}

const App: React.FC = () => {
  const [ws, setWs] = useState<WebSocket>()
  // const [state, dispatch] = useReducer(clickReducer, initialState);
  const [state, setState] = useState<VisibleState>([[]]);
  const [isAutoPlay, setAutoPlay] = useState(false);
  const [gamePhase, dispatchPhase] = useReducer(phaseReducer, 'WAITING')
  const [levelChosen, setLevelChosen] = useState(1);
  const [quickSolver, _] = useState(new QuickSolver())

  const visibleAndSuggested = nextSuggestedCells(state);

  useEffect(() => {
    const w = new WebSocket('wss://hometask.eg1236.com/game1/');
    w.onopen = () => {
      setWs(w);
    }
    w.onmessage = ({ data }: { data: string }) => {
      if (data.startsWith('new: OK')) {
        dispatchPhase('START');
      } else if (data.startsWith('map:')) {
        const rows = data.split('\n');
        quickSolver.update(
          rows.slice(1).map(row => row.split('').map(charToVisibleCell)),
          w
        );
      } else if (data.startsWith('open: You lose')) {
        quickSolver.stop()
        dispatchPhase('LOSE');
      } else if (data.startsWith('open: You win')) {
        quickSolver.stop();
        dispatchPhase('WIN');
        console.log(data);
      }
    }
    return () => {
      w.close();
    }
  }, []);

  function clickCell([col, row]: Position) {
    if (!ws) {
      return;
    }
    ws.send(`open ${col} ${row}`);
    ws.send('map');
  }

  useEffect(() => {
    const t = setInterval(() => {
      setState(quickSolver.state);
    }, 200);
    return () => {
      clearInterval(t);
    }
  }, []);

  useEffect(() => {
    if (gamePhase === 'LOST') {
      quickSolver.start();
      startLevel(levelChosen);
      return;
    }
    if (gamePhase === 'WON') {
      quickSolver.stop()
      setState(quickSolver.state);
      return;
    }
  }, [gamePhase])

  function startLevel(num: number) {
    if (!ws) {
      return;
    }
    setLevelChosen(num);
    ws.send(`new ${num}`);
    ws.send('map');
  }

  const bombDensity = bombDensityInVisibleCells(visibleAndSuggested).toFixed(3);

  return (
    <div>
      <h1>MINESWEEPER!!</h1>
      <div className="auto">
        {isAutoPlay ? <button onClick={() => setAutoPlay(false)}>Stop</button> : <button onClick={() => setAutoPlay(true)}>AutoPlay</button>}
      </div>
      <div id="table-container">
        <p className="density">Density: {bombDensity}</p>
        <ul className="btns">
          {[1, 2, 3, 4].map(n => <li key={n}><button onClick={() => startLevel(n)}>Start Level {n}</button></li>)}
        </ul>
        {
          gamePhase === 'LOST' ? <div>You lose</div> : null
        }
        {
          gamePhase === 'WON' ? <div>You win</div> : null
        }
        <table>
          <tbody>
            {visibleAndSuggested.map(((row, rowIndex) => <Row
              key={rowIndex}
              row={row}
              index={rowIndex}
              dispatch={clickCell}
            />))}
          </tbody>
        </table>
        <h3>Legend</h3>
        <table>
          <tbody>
            <tr>{
              [Space.ExplodedBomb, Space.EmptySpace, Space.MarkedAsBomb, 'SuggestedClick', 'KnownSafeSpace'].map(x =>
                <td key={x} className={bombClass(x as any)}>{x}</td>
              )
            }</tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
