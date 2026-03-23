const crypto = require('crypto');

class StateManager {
  constructor() {
    this.visited = new Set();
    this.queue = [];
  }

  /**
   * Generate a hash for the current page state
   * Uses URL + visible text content to create a unique state identifier
   */
  generateStateHash(url, pageText) {
    const normalized = `${url}::${pageText.trim().substring(0, 500)}`;
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Check if a state has been visited before
   */
  isVisited(stateHash) {
    return this.visited.has(stateHash);
  }

  /**
   * Mark a state as visited
   */
  markVisited(stateHash) {
    this.visited.add(stateHash);
  }

  /**
   * Add actions to the BFS queue
   */
  enqueue(actions) {
    for (const action of actions) {
      this.queue.push(action);
    }
  }

  /**
   * Get next action from queue
   */
  dequeue() {
    return this.queue.shift() || null;
  }

  /**
   * Check if queue is empty
   */
  isEmpty() {
    return this.queue.length === 0;
  }

  /**
   * Get queue size
   */
  size() {
    return this.queue.length;
  }

  /**
   * Get visited count
   */
  visitedCount() {
    return this.visited.size;
  }
}

module.exports = StateManager;
