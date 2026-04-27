/**
 * @jest-environment jsdom
 */

import { collectSets } from '../../../static/js/sets.js';
import { state } from '../../../static/js/state.js';

describe('Sets Module - collectSets', () => {
  beforeEach(() => {
    // Reset state
    state.ui = { exerciseMap: {} };

    // Setup DOM
    document.body.innerHTML = '';
  });

  test('should collect valid sets with reps', () => {
    // Create DOM structure
    const container = document.createElement('div');
    container.id = 'sets-ex1';
    container.innerHTML = `
      <div id="set-1">
        <input type="number" data-type="reps" value="10" />
        <input type="number" data-type="weight" value="100" />
      </div>
      <div id="set-2">
        <input type="number" data-type="reps" value="8" />
        <input type="number" data-type="weight" value="110" />
      </div>
    `;
    document.body.appendChild(container);

    const sets = collectSets('ex1');

    expect(sets).toHaveLength(2);
    expect(sets[0]).toEqual({ reps: 10, weight: 100 });
    expect(sets[1]).toEqual({ reps: 8, weight: 110 });
  });

  test('should collect valid sets with duration', () => {
    const container = document.createElement('div');
    container.id = 'sets-ex1';
    container.innerHTML = `
      <div id="set-1">
        <input type="number" data-type="time" value="60" />
        <input type="number" data-type="weight" value="0" />
      </div>
    `;
    document.body.appendChild(container);

    const sets = collectSets('ex1');

    expect(sets).toHaveLength(1);
    expect(sets[0]).toEqual({ duration_sec: 60, weight: 0 });
  });

  test('should filter out invalid sets with zero reps', () => {
    const container = document.createElement('div');
    container.id = 'sets-ex1';
    container.innerHTML = `
      <div id="set-1">
        <input type="number" data-type="reps" value="0" />
        <input type="number" data-type="weight" value="100" />
      </div>
      <div id="set-2">
        <input type="number" data-type="reps" value="10" />
        <input type="number" data-type="weight" value="100" />
      </div>
    `;
    document.body.appendChild(container);

    const sets = collectSets('ex1');

    expect(sets).toHaveLength(1);
    expect(sets[0]).toEqual({ reps: 10, weight: 100 });
  });

  test('should filter out invalid sets with empty reps', () => {
    const container = document.createElement('div');
    container.id = 'sets-ex1';
    container.innerHTML = `
      <div id="set-1">
        <input type="number" data-type="reps" value="" />
        <input type="number" data-type="weight" value="100" />
      </div>
      <div id="set-2">
        <input type="number" data-type="reps" value="10" />
        <input type="number" data-type="weight" value="100" />
      </div>
    `;
    document.body.appendChild(container);

    const sets = collectSets('ex1');

    expect(sets).toHaveLength(1);
  });

  test('should handle missing weight as 0', () => {
    const container = document.createElement('div');
    container.id = 'sets-ex1';
    container.innerHTML = `
      <div id="set-1">
        <input type="number" data-type="reps" value="10" />
      </div>
    `;
    document.body.appendChild(container);

    const sets = collectSets('ex1');

    expect(sets).toHaveLength(1);
    expect(sets[0].weight).toBe(0);
  });

  test('should handle decimal weights', () => {
    const container = document.createElement('div');
    container.id = 'sets-ex1';
    container.innerHTML = `
      <div id="set-1">
        <input type="number" data-type="reps" value="10" />
        <input type="number" data-type="weight" value="22.5" />
      </div>
    `;
    document.body.appendChild(container);

    const sets = collectSets('ex1');

    expect(sets).toHaveLength(1);
    expect(sets[0].weight).toBe(22.5);
  });

  test('should return empty array when no sets div exists', () => {
    const sets = collectSets('nonexistent');

    expect(sets).toEqual([]);
  });

  test('should return empty array when no valid sets', () => {
    const container = document.createElement('div');
    container.id = 'sets-ex1';
    container.innerHTML = `
      <div id="set-1">
        <input type="number" data-type="reps" value="0" />
        <input type="number" data-type="weight" value="100" />
      </div>
    `;
    document.body.appendChild(container);

    const sets = collectSets('ex1');

    expect(sets).toEqual([]);
  });

  test('should handle mixed reps and time sets', () => {
    const container = document.createElement('div');
    container.id = 'sets-ex1';
    container.innerHTML = `
      <div id="set-1">
        <input type="number" data-type="reps" value="10" />
        <input type="number" data-type="weight" value="100" />
      </div>
      <div id="set-2">
        <input type="number" data-type="time" value="60" />
        <input type="number" data-type="weight" value="0" />
      </div>
    `;
    document.body.appendChild(container);

    const sets = collectSets('ex1');

    expect(sets).toHaveLength(2);
    expect(sets[0]).toHaveProperty('reps');
    expect(sets[1]).toHaveProperty('duration_sec');
  });
});
