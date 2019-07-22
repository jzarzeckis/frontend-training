import { bombClass, Space, generateRandomFields, nearbyBombCount, isGameWon, stateAfterClick } from './App';

function textToMatrix(input: string): Space[][] {
  return input.trim().split('\n').map(row => row.trim().split('').map(x => x as Space))
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

describe("The state update function", () => {
  it('Clicking on a hidden bomb returns an exploded bomb', () => {
    expect(
      stateAfterClick(
        textToMatrix("@"), 0, 0
      )
    ).toEqual(textToMatrix("X"));
  })

  it('Clicking on empty space should turn it into clicked space', () => {
    const stateBefore = textToMatrix(`
      ^^
      @^
    `);
    const expectedStateAfter = `
      ^#
      @^
    `;

    expect(stateAfterClick(stateBefore, 1, 0)).toEqual(textToMatrix(expectedStateAfter));
  });

  it('Clicking on an exploded bomb should not change the state', () => {
    const state = `
      ^X
      @^
    `;
    expect(
      stateAfterClick(textToMatrix(state), 1, 0)
    ).toEqual(textToMatrix(state));
  });
});
