import { expect, test } from 'claude-code/testing'

import { NO_FOCUS, applyPlan, applyWrapUp, clearAsk, focusView } from './focus'

const plan = applyPlan(
  NO_FOCUS,
  {
    items: [
      { content: 'Read', status: 'in_progress' },
      { content: 'Build', status: 'pending' },
      { content: 'Test', status: 'pending' },
    ],
  },
  1000,
)

test('a new list is taken over with its start time', async () => {
  expect(plan.items.length).toBe(3)
  expect(plan.startedAt).toBe(1000)
  const v = focusView(plan, true)
  expect(v.kind).toBe('working')
  expect(v.current).toBe('Read')
  expect(v.done).toBe(0)
})

test('advance completes the running step and starts the next', async () => {
  const f = applyPlan(plan, { advance: true }, 2000)
  expect(f.items[0].status).toBe('completed')
  expect(f.items[1].status).toBe('in_progress')
  expect(f.startedAt).toBe(1000)
  expect(focusView(f, true).current).toBe('Build')
})

test('done and start by 1-based number', async () => {
  const f = applyPlan(plan, { done: [1, 2], start: 3 }, 2000)
  expect(f.items.map(i => i.status).join(',')).toBe('completed,completed,in_progress')
})

test('wrap-up with two buttons is a decision, with one it is your turn', async () => {
  const decide = applyWrapUp(plan, { ask: 'Bauen?', actions: [{ label: 'Ja' }, { label: 'Nein' }] })
  expect(decide.items.every(i => i.status === 'completed')).toBe(true)
  expect(focusView(decide, false).kind).toBe('decide')
  expect(focusView(decide, false).you).toBe('Bauen?')
  const turn = applyWrapUp(plan, { ask: 'Screenshot?', actions: '[{"label":"Kommt"}]' })
  expect(focusView(turn, false).kind).toBe('turn')
  expect(focusView(turn, true).kind).toBe('working')
})

test('no question means read the answer; a new turn clears the question', async () => {
  const done = applyWrapUp(plan, { recap: 'x' })
  expect(focusView(done, false).kind).toBe('read')
  const asked = applyWrapUp(plan, { ask: 'Ok?' })
  expect(clearAsk(asked).ask).toBe(null)
  expect(focusView(NO_FOCUS, false).kind).toBe('none')
})
