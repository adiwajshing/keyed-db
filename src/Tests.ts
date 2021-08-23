import KeyedDB from './KeyedDB'
import assert from 'assert'
import { Comparable } from './Types';
import binarySearch from './BinarySearch';

const DATA_LENGTH = 20_000

function hashCode(s: string) {
    for(var i = 0, h = 0; i < s.length; i++)
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h;
}
type ActivePhoneCall = {
    callStart: number
    from: string
    info?: any
}
const phoneCallKey = {
    key: (p: ActivePhoneCall) => p.callStart*1000 + (hashCode(p.from) % 1000),
    compare: (a, b) => a-b
} 
const phoneCallKeyStr: Comparable<ActivePhoneCall, string> = {
    key: (p: ActivePhoneCall) => p.callStart.toString() + p.from,
    compare: (a, b) => a.localeCompare (b)
}
const doSorted = (list: ActivePhoneCall[], key) => list.sort ((a, b) => (
    key.key ? key.compare(key.key(a), key.key(b)) : (key(a) - key(b))
))
describe ('Binary Search Tests', () => {
    it ('should work with one item', () => {
        const array = [100]
    
        const index = binarySearch (array, item => 111-item)
        assert.strictEqual (index, 1)

        const index2 = binarySearch (array, item => 90-item)
        assert.strictEqual (index2, -1)
    })
    it ('should work', () => {
        const array = [1,2,3,4,5,10,16,91,240]
        
        const sIndex = Math.floor(Math.random ()*array.length)
        let index = binarySearch (array, item => array[sIndex]-item)
        
        let value = 70
        index = binarySearch (array, item => value-item)
        assert.strictEqual (index, array.length-2)

        value = 700
        index = binarySearch (array, item => value-item)
        assert.strictEqual (index, array.length)

        value = -1
        index = binarySearch (array, item => value-item)
        assert.strictEqual (index, -1)
    })
}) 

describe ('KeyedDB Test', () => {
    let data: ActivePhoneCall[]
    before (() => {
        data = [...Array(DATA_LENGTH)]
                .map ((_, i) => ({callStart: (Math.random()*10000 + 10000), from: `Jeff ${i}`}))
        
    })
    const correctlySortTest = key => {
        const db = new KeyedDB (key)
        
        data.forEach (v => db.insert(v))
        const sorted = doSorted([...data], key)
        for (let i = 0; i < sorted.length;i++) {
            assert.strictEqual (db.all()[i], sorted[i])
        }
    }
    it ('should be a correctly sorted DB', () => {
        correctlySortTest (phoneCallKey)
        correctlySortTest (phoneCallKeyStr)
    })
    it ('should reinsert correctly in the DB', () => {
        const db = new KeyedDB (phoneCallKey)
        data.forEach (v => db.insert(v))

        for(let i = 0; i < db.length*0.7;i++) {
            const itemIndex = Math.floor(Math.random()*db.all().length)
            // insert again as long as it's not the lowest one we've inserted
            db.all()[itemIndex].callStart > 1000 && assert.strictEqual(
                db.updateKey (db.all()[itemIndex], value => value.callStart = 1000 + i),
                2
            )
        }
        
        assert.strictEqual (db.first.callStart, 1000)
    })
    const paginationTest = (predicate) => {
        let content = data

        const db = new KeyedDB (phoneCallKey)
        content.forEach (v => db.insert(v))

        if (predicate) content = data.filter (predicate)

        let totalChats = []
        let prevChats = db.paginated (null, 25, predicate)
        
        while (prevChats.length > 0) {
            totalChats.push (...prevChats)
            const cursor = (phoneCallKey.key(prevChats[prevChats.length-2])+phoneCallKey.key(prevChats[prevChats.length-1]))/2
            
            const newChats = db.paginated (cursor, 25, predicate)
            assert.deepStrictEqual (newChats[0], prevChats[prevChats.length-1])

            const newChats2 = db.paginatedByValue (newChats[0], 25, predicate)
            if (newChats2.length > 0) {
                assert.ok ( phoneCallKey.key(newChats2[0]) > phoneCallKey.key(prevChats[prevChats.length-1]))
            }
            prevChats = newChats2
        }
        assert.strictEqual (totalChats.length, content.length)
        let sorted = content.sort ((a, b) => phoneCallKey.key(a) - phoneCallKey.key(b))

        for (let i in totalChats) {
            assert.deepStrictEqual (totalChats[i], sorted[i], "failed at index " + i)
        }
    }
    const paginationTestBefore = predicate => {
        let content = data

        const db = new KeyedDB (phoneCallKey)
        content.forEach (v => db.insert(v))

        if (predicate) content = data.filter (predicate)

        let totalChats = []
        let prevChats = db.paginatedByValue (null, 25, predicate, 'before')
        
        while (prevChats.length > 0) {
            totalChats.unshift (...prevChats)
            const cursor = (phoneCallKey.key(prevChats[0])+phoneCallKey.key(prevChats[1]))/2
            
            const newChats = db.paginated (cursor, 25, predicate, 'before')
            assert.deepStrictEqual (newChats[newChats.length-1], prevChats[0])

            const newChats2 = db.paginatedByValue (newChats[newChats.length-1], 25, predicate, 'before')
            if (newChats2.length > 0) {
                assert.ok ( phoneCallKey.key(newChats2[0]) < phoneCallKey.key(prevChats[0]))
            }
            prevChats = newChats2
        }
        assert.strictEqual (totalChats.length, content.length)
        let sorted = content.sort ((a, b) => phoneCallKey.key(a) - phoneCallKey.key(b))

        for (let i in totalChats) {
            assert.deepStrictEqual (totalChats[i], sorted[i], "failed at index " + i)
        }
    }

    const paginationTestStr = (predicate) => {
        let content = data

        const db = new KeyedDB (phoneCallKeyStr)
        db.insert(...content)

        if (predicate) content = data.filter (predicate)

        let totalChats = []
        let prevChats = db.paginated (null, 25, predicate)
        
        while (prevChats.length > 0) {
            totalChats.push (...prevChats)
            const newChats2 = db.paginatedByValue (prevChats[prevChats.length-1], 25, predicate)
            if (newChats2.length > 0) {
                assert.ok ( phoneCallKeyStr.compare(phoneCallKeyStr.key(newChats2[0]), phoneCallKeyStr.key(prevChats[prevChats.length-1])) )
            }
            prevChats = newChats2
        }
        assert.strictEqual (totalChats.length, content.length)
        let sorted = doSorted([...content], phoneCallKeyStr)

        for (let i in totalChats) {
            assert.deepStrictEqual (totalChats[i], sorted[i], "failed at index " + i)
        }
    }
    it ('should update values correctly', () => {
        let content = doSorted([...data], phoneCallKeyStr)
        const idx = content.length/2
        const db = new KeyedDB (phoneCallKeyStr)
        // insert half the values
        db.insert(...content.slice(idx))
        
        // test upsert
        content[idx] = { ...content[idx], info: 1234 }
        const [updated] = db.upsert(content[idx])
        assert.ok(db.first.info)
        assert.deepStrictEqual(updated, db.first)
        assert.deepStrictEqual(
            db.filter(item => phoneCallKeyStr.key(item) === phoneCallKeyStr.key(content[idx])).all(),
            [ content[idx] ]
        )
        assert.deepStrictEqual(
            db.upsert(content[0]),
            []
        )
        assert.deepStrictEqual(content[0], db.first)

        // test delete by id
        db.deleteById(phoneCallKeyStr.key(content[0]))
        assert.deepStrictEqual(content[idx], db.first)

        // test insert if absent
        content[idx] = { ...content[idx], info: 55 }
        db.insertIfAbsent(content[idx])
        assert.notDeepStrictEqual(content[idx], db.first)
        assert.strictEqual(1234, db.first.info)

        const [insertion0] = db.insertIfAbsent(content[idx-1])
        assert.ok(insertion0)
        assert.strictEqual(db.first, content[idx-1])
        assert.deepStrictEqual(insertion0, content[idx-1])

        const item = db.delete(content[idx+2])
        const [insertion] = db.insertIfAbsent(item)
        assert.deepStrictEqual(insertion, item)
    })
    it ('should paginate \'after\' correctly', () => {
        paginationTest (null)
        paginationTest (call => call.callStart > 15000)
        paginationTest (call => call.callStart < 17000)
    })
    it ('should paginate \'after\' correctly with str', () => {
        paginationTestStr (null)
        paginationTestStr (call => call.callStart > 15000)
        paginationTestStr (call => call.callStart < 17000)
    })
    it ('should paginate \'before\' correctly', () => {
        paginationTestBefore (null)
        paginationTest (call => call.callStart > 15000)
        paginationTest (call => call.callStart < 17000)
    })
    
    it ('should serialize correctly', () => {
        const db = new KeyedDB (phoneCallKey)
        data.forEach (v => db.insert(v))

        assert.strictEqual (
            JSON.stringify(db),
            JSON.stringify(db['array'])
        )
        assert.strictEqual (
            JSON.stringify(
                { db }
            ),
            JSON.stringify(
                { db: db['array'] }
            )
        )
    })
    it('should iterate', () => {
        const db = new KeyedDB (phoneCallKey)
        data.forEach (v => db.insert(v))

        const result = []
        for (let item of db) {
            result.push(item)
        }
        assert.deepStrictEqual (result, data)
    })
})