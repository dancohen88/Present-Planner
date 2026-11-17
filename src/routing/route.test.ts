import { describe, expect, it } from 'vitest'
import { parseRoute, paths } from './route.ts'

const ID = '2b1e8f4a-5c3d-4e6f-8a9b-0c1d2e3f4a5b'

describe('parseRoute', () => {
  it.each([
    ['', { name: 'home' }],
    ['#/', { name: 'home' }],
    [`#/plan/${ID}`, { name: 'plan', planId: ID }],
    [`#/join/${ID}`, { name: 'join', token: ID }],
    ['#/new', { name: 'new-plan' }],
    // A mangled plan id falls back to home rather than querying with junk.
    ['#/plan/not-a-uuid', { name: 'home' }],
    ['#/somewhere-else', { name: 'home' }],
  ])('reads %j', (hash, expected) => {
    expect(parseRoute(hash)).toEqual(expected)
  })

  it('reads back every path it builds', () => {
    expect(parseRoute(paths.plan(ID))).toEqual({ name: 'plan', planId: ID })
    expect(parseRoute(paths.join(ID))).toEqual({ name: 'join', token: ID })
    expect(parseRoute(paths.newPlan)).toEqual({ name: 'new-plan' })
    expect(parseRoute(paths.home)).toEqual({ name: 'home' })
  })
})
