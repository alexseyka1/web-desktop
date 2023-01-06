export class LinkedListNode {
  value
  /** @type {LinkedListNode|null} */
  next

  constructor(value) {
    this.value = value
  }
}

/**
 * [1]
 * [1] -> [2]
 * [1] -> [2] -> [3] -> [4]
 * For removing [2] we need:
 * - find [1], who linked to [2] and set him ::next to [3].next
 * - remove [2] from array
 * [1] -> [3] -> [4]
 */
class LinkedList {
  /** @type {Set<LinkedListNode>} */
  #list = new Set()
  /** @type {LinkedListNode} */
  head
  /** @type {LinkedListNode} */
  #tail

  /**
   * @param {Function[]} arr
   * @returns {LinkedListNode}
   */
  add(item) {
    const newNode = new LinkedListNode(item)
    this.#list.add(newNode)

    if (!this.head) this.head = newNode
    if (this.#tail) this.#tail.next = newNode

    this.#tail = newNode
  }

  /**
   * @param {Function} item
   */
  remove(item) {
    let _prevNode
    let _head = this.head

    do {
      if (_head.value === item) {
        if (_prevNode) {
          _prevNode.next = _head.next
        } else {
          this.head = _head.next
        }

        _head.next = null
        this.#list.delete(_head)

        break
      }
      _prevNode = _head
    } while ((_head = _head.next))
  }
}

export default LinkedList
