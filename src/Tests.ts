import KeyedDB, { binarySearch } from './KeyedDB'
import assert from 'assert'

function hashCode(s: string) {
    for(var i = 0, h = 0; i < s.length; i++)
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h;
}
type ActivePhoneCall = {
    callStart: number
    from: string
}
const phoneCallKey = (p: ActivePhoneCall) => p.callStart*1000 + (hashCode(p.from) % 1000)

describe ('Binary Search Tests', () => {
    it ('should work with one item', () => {
        const array = [100]
    
        const index = binarySearch (array, item => 111-item)
        assert.equal (index, 1)

        const index2 = binarySearch (array, item => 90-item)
        assert.equal (index2, -1)
    })
    it ('should work', () => {
        const array = [1,2,3,4,5,10,16,91,240]
        
        const sIndex = Math.floor(Math.random ()*array.length)
        let index = binarySearch (array, item => array[sIndex]-item)
        
        let value = 70
        index = binarySearch (array, item => value-item)
        assert.equal (index, array.length-2)

        value = 700
        index = binarySearch (array, item => value-item)
        assert.equal (index, array.length)

        value = -1
        index = binarySearch (array, item => value-item)
        assert.equal (index, -1)
    })
}) 

describe ('KeyedDB Test', () => {
    let data: ActivePhoneCall[]
    before (() => {
        data = [...Array(4132)]
                .map ((_, i) => ({callStart: (Math.random()*10000 + 10000), from: `Jeff ${i}`}))
        
    })
    it ('should be a correctly sorted DB', () => {
        const db = new KeyedDB (phoneCallKey)
        
        data.forEach (v => db.insert(v))
        const sorted = data.sort ((a, b) => phoneCallKey(a) - phoneCallKey(b))

        for (let i in sorted) {
            assert.equal (db.all()[i], sorted[i])
        }
    })
    it ('should reinsert correctly in the DB', () => {
        const db = new KeyedDB (phoneCallKey)
        data.forEach (v => db.insert(v))
        
        const itemIndex = Math.floor(Math.random()*db.all().length)
        db.updateKey (db.all()[itemIndex], value => value.callStart = 1000)
        
        assert.equal (db.all()[0].callStart, 1000)
    })
    const paginationTest = predicate => {
        let content = data

        const db = new KeyedDB (phoneCallKey)
        content.forEach (v => db.insert(v))

        if (predicate) content = data.filter (predicate)

        let totalChats = []
        let prevChats = db.paginated (null, 25, predicate)
        
        while (prevChats.length > 0) {
            totalChats.push (...prevChats)
            const cursor = (phoneCallKey (prevChats[prevChats.length-2])+phoneCallKey (prevChats[prevChats.length-1]))/2
            
            const newChats = db.paginated (cursor, 25, predicate)
            assert.deepEqual (newChats[0], prevChats[prevChats.length-1])

            const newChats2 = db.paginatedByValue (newChats[0], 25, predicate)
            if (newChats2.length > 0) {
                assert.ok ( phoneCallKey(newChats2[0]) > phoneCallKey(prevChats[prevChats.length-1]))
            }
            prevChats = newChats2
        }
        assert.equal (totalChats.length, content.length)
        let sorted = content.sort ((a, b) => phoneCallKey(a) - phoneCallKey(b))

        for (let i in totalChats) {
            assert.deepEqual (totalChats[i], sorted[i], "failed at index " + i)
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
            const cursor = (phoneCallKey (prevChats[0])+phoneCallKey (prevChats[1]))/2
            
            const newChats = db.paginated (cursor, 25, predicate, 'before')
            assert.deepEqual (newChats[newChats.length-1], prevChats[0])

            const newChats2 = db.paginatedByValue (newChats[newChats.length-1], 25, predicate, 'before')
            if (newChats2.length > 0) {
                assert.ok ( phoneCallKey(newChats2[0]) < phoneCallKey(prevChats[0]))
            }
            prevChats = newChats2
        }
        assert.equal (totalChats.length, content.length)
        let sorted = content.sort ((a, b) => phoneCallKey(a) - phoneCallKey(b))

        for (let i in totalChats) {
            assert.deepEqual (totalChats[i], sorted[i], "failed at index " + i)
        }
    }
    it ('should paginate \'after\' correctly', () => {
        paginationTest (null)
        paginationTest (call => call.callStart > 15000)
        paginationTest (call => call.callStart < 17000)
    })
    it ('should paginate \'before\' correctly', () => {
        paginationTestBefore (null)
        paginationTest (call => call.callStart > 15000)
        paginationTest (call => call.callStart < 17000)
    })

    it ('should serialize correctly', () => {
        const db = new KeyedDB (phoneCallKey)
        data.forEach (v => db.insert(v))

        assert.equal (
            JSON.stringify(db),
            JSON.stringify(db['array'])
        )
        assert.equal (
            JSON.stringify(
                { db }
            ),
            JSON.stringify(
                { db: db['array'] }
            )
        )
    })
})