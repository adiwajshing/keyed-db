type PaginationMode = 'before' | 'after'
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
  get length () {
    return this.all().length
  }
  insert(value: T) {
    if (!value) throw new Error ('undefined value')

    if (this.array.length > 0) {
      const index = this.firstIndex (value)
      
      if (index >= this.array.length) this.array.push (value)
      else if (index < 0) this.array.unshift (value)
      else if (this.key(value) !== this.key(this.array[index])) this.array.splice (index, 0, value)
      else throw new Error(`duplicate key: ${this.key(value)}, of inserting: ${this.idGetter(value)}, present: ${this.idGetter(this.array[index])}`)
    
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
  filter (predicate: (value: T, index: number) => boolean) {
    const db = new KeyedDB (this.key, this.idGetter)
    db.array = this.array.filter ((value, index) => {
      if (predicate(value, index)) {
        db.dict[ this.idGetter (value) ] = value
        return true
      }
    })
    return db
  }
  /**
   * Get the values of the data in a paginated manner
   * @param value the value itself beyond which the content is to be retreived
   * @param limit max number of items to retreive
   * @param predicate optional filter
   * @param mode whether to get the content `before` the cursor or `after` the cursor; default=`after`
   */
  paginatedByValue(value: T | null, limit: number, predicate?: (value: T, index: number) => boolean, mode: PaginationMode = 'after') {
    return this.paginated (value && this.key(value), limit, predicate, mode)
  }
  /**
   * Get the values of the data in a paginated manner
   * @param value the cursor beyond which the content is to be retreived
   * @param limit max number of items to retreive
   * @param predicate optional filter
   * @param mode whether to get the content `before` the cursor or `after` the cursor; default=`after`
   */
  paginated(cursor: number | null, limit: number, predicate?: (value: T, index: number) => boolean, mode: PaginationMode = 'after') {
    let index = mode === 'after' ? 0 : this.array.length
    if (cursor) {
      index = binarySearch (this.array, v => cursor-this.key(v))
    
      if (index < 0) index = 0
      if (this.key(this.array[index]) === cursor) index += (mode === 'after' ? 1 : 0)
    }
    return this.filtered (index, limit, mode, predicate)
  }
  private filtered (start: number, count: number, mode: PaginationMode, predicate?: (value: T, index: number) => boolean) {
    let arr: T[]
    if (mode === 'after') {
      if (predicate) {
        arr = []
        for (let item of this.array.slice (start)) {
          predicate (item, start+arr.length) && arr.push (item)
          if (arr.length >= count) break
        }
      } else arr = this.array.slice (start, start+count)
    } else if (mode === 'before') {
      if (predicate) {
        arr = []
        for (let i = start-1; i >= 0; i--) {
          let item = this.array[i]
          predicate (item, start+arr.length) && arr.unshift (item)
          if (arr.length >= count) break
        }
      } else arr = this.array.slice ( Math.max(start-count, 0), start)
    }
    return arr
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