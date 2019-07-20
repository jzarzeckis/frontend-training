import { bombClass, Space, generateRandomFields, nearbyBombCount, isGameWon } from './App';

function textToMatrix(input: string): Space[][] {
  return input.split('\n').map(row => row.trim().split('').map(s => 
    s === "X" ? Space.ExplodedBomb :
      s === "^" ? Space.EmptySpace :
      s === "#" ? Space.ClickedSpace :
      s === "@" ? Space.HiddenBomb : Space.HiddenBomb
  ))
}

it('adds the correct classes to table cells', () => {
  expect(bombClass(Space.EmptySpace)).toBe("");
  expect(bombClass(Space.ClickedSpace)).toBe("open");
  expect(bombClass(Space.ExplodedBomb)).toBe("bomb");
  expect(bombClass(Space.HiddenBomb)).toBe("");
});

it('generates the initial state in the specified size', () => {
  const matrix = generateRandomFields(4, 7);
  expect(matrix.length).toBe(7);
  for (const row of matrix) {
    expect(row.length).toBe(4);
  }
});

it('counts the bombs around a cell', () => {
  const testMatrix = [
    [ Space.ClickedSpace, Space.EmptySpace, Space.EmptySpace ],
    [ Space.ClickedSpace, Space.HiddenBomb, Space.ClickedSpace ],
    [ Space.ClickedSpace, Space.EmptySpace, Space.HiddenBomb ],
    [ Space.HiddenBomb, Space.EmptySpace, Space.EmptySpace ]
  ]

  expect(nearbyBombCount(0, 0, testMatrix)).toBe(1);
  expect(nearbyBombCount(40, 32, testMatrix)).toBe(0);
  expect(nearbyBombCount(2, 3, testMatrix)).toBe(1);
  expect(nearbyBombCount(1, 2, testMatrix)).toBe(2);
});

it('knows when I have won', () => {
  const space = `^^^^
                 ^^^^
                 ^X@^`;
  expect(isGameWon(textToMatrix(space))).toBe(false);
  expect(isGameWon(textToMatrix(`###
                                 #@#
                                 ###`))).toBe(true);
                                
  expect(isGameWon(textToMatrix(`###
                                 #X#
                                 ###`))).toBe(false);
})