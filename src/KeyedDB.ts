export default class KeyedDB<T> {
  private array: Array<T>
  private dict: { [key: string]: T }
  /* Order values */
  private key: (v: T) => number
  /* Identify values */
  private idGetter: (v: T) => string
  /**
   * 
   * @param key Return the unique key used to sort items
   * @param id The unique ID for the items
   */
  constructor(key: (v: T) => number, id?: (v: T) => string) {
    this.key = key
    this.idGetter = id || (v => key(v).toString())
    this.dict = {}
    this.array = []
  }

  insert(value: T) {
    if (!value) throw new Error ('undefined value')

    if (this.array.length > 0) {
      const index = this.firstIndex (value)
      
      if (index >= this.array.length) this.array.push (value)
      else if (index < 0) this.array.unshift (value)
      else if (this.key(value) !== this.key(this.array[index])) this.array.splice (index, 0, value)
      else throw new Error(`duplicate key: ${this.key(value)}, values: ${JSON.stringify(value)}, ${JSON.stringify(this.array[index])}`)
    
    } else {
      this.array.push (value)
    }  
    this.dict[this.idGetter(value)] = value
  }

  delete(value: T) {
    const index = this.firstIndex (value)
    if (index < 0 || index >= this.array.length || this.key(value) !== this.key(this.array[index])) {
        return null
    }
    delete this.dict[this.idGetter(value)]
    return this.array.splice (index, 1)[0]
  }
  clear() {
    this.array = []
    this.dict = {}
  }
  get(id: string) {
    return this.dict[id]
  }
  all() {
    return this.array
  }
  updateKey(value: T, update: (value: T) => void) {
    this.delete (value)
    update (value)
    this.insert (value)
  }
  paginatedByValue(value: T | null, limit: number) {
    return this.paginated (value && this.key(value), limit)
  }
  paginated(cursor: number | null, limit: number) {
    if (!cursor) return this.array.slice(0, limit)

    let index = binarySearch (this.array, v => cursor-this.key(v))
    
    if (index < 0) return this.array.slice (0, limit)
    if (this.key(this.array[index]) === cursor) index += 1
    if (index >= this.array.length) return []

    return this.array.slice (index, index+limit)
  }
  private firstIndex (value: T) {
    return binarySearch (this.array, v => this.key(value)-this.key(v))
  }
}
/**
 * 
 * @param array the array to search in
 * @param predicate return a value of < 0, if the item you're looking for should come before, 0 if it is the item you're looking for
 */
export function binarySearch<T>(array: T[], predicate: (T) => number) {
    let low = 0
    let high = array.length

    if (array.length === 0) return low
    
    if (predicate(array[low]) < 0) return low-1
    else if (predicate(array[low]) === 0) return low

    const maxPred = predicate(array[high-1])
    if (maxPred > 0) return high
    else if (maxPred === 0) return high-1
    
    while (low !== high) {
        const mid = low + Math.floor((high-low)/2)
        const pred = predicate (array[mid])
        
        if (pred < 0) high = mid
        else if (pred > 0) low = mid+1
        else return mid
    }
    return low 
}