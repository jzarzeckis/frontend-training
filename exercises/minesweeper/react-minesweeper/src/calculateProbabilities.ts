
export enum Space {
  HiddenBomb = "Hidden",
  EmptySpace = "Empty",
  ExplodedBomb = "Exploded",
  ClickedSpace = "Clicked",
  MarkedAsBomb = "Marked"
}
export type Position = [number, number];
// Array containing **relative** indices of the cells around some cell
const relativeNeighbors: Position[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
];

export function relativeNeighborContent<T>(data: T[][], col: number, row: number): { content: T, col: number, row: number }[] {
  const s = Symbol();
  return relativeNeighbors.map(([rCol, rRow]) => {
    const absCol = col + rCol;
    const absRow = row + rRow;
    if (absRow < 0 || absRow >= data.length) return s;
    if (absCol < 0 || absCol >= data[absRow].length) return s;
    return { content: data[absRow][absCol], col: absCol, row: absRow };
  }).filter((x): x is { content: T, col: number, row: number } => x !== s);
}


export function nearbyBombCount(
  rowIndex: number,
  cellIndex: number,
  matrix: Array<Array<Space | number>>
) {
  // Iterate through all neighbors of this cell, and count bombs
  return relativeNeighborContent(matrix, cellIndex, rowIndex).reduce((count, { content }) =>
    content === Space.HiddenBomb || content === Space.ExplodedBomb ? count + 1 : count
    , 0);
}

type PossibleCell = number | Space.HiddenBomb | Space.EmptySpace;

export function simulateProbabilities(
  assumedDensity: number,
  map: string,
  iterations: number,
): number[][] {
  const matchingPossibilities = Array(iterations).fill(null).map(() =>
    map.trim().split('\n').map(row =>
      row.split('').map(char =>
        char === '#' ? (Math.random() < assumedDensity ? Space.HiddenBomb : Space.EmptySpace) : parseInt(char)))
  ).filter(possibility => possibility.every((row, rowIndex) => row.every((cell, cellIndex) => {
    if (typeof cell !== 'number') {
      return true;
    }
    return nearbyBombCount(rowIndex, cellIndex, possibility) === cell;
  })));

  const matchLength = matchingPossibilities.length;

  const sumsArray: number[][] = Array(matchingPossibilities[0].length).fill(null).map(() => Array(matchingPossibilities[0][0].length).fill(0));

  return matchingPossibilities.reduce<number[][]>((acc, possibility) => {
    return acc.map((row, rowId): number[] =>
      row.map((cell, cellId): number => {
        const matchingCell: PossibleCell = possibility[rowId][cellId];
        return (matchingCell === Space.HiddenBomb) ? (cell + (1 / matchLength)) : cell;
      })
    );
  }, sumsArray);
}

const map = `
###
#5#
###
#1#
###
`

console.table(simulateProbabilities(0.18, map, 10000).map(row => row.map(cell => cell.toFixed(2))));