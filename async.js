
function delayGreet () {
    return new Promise(function(resolve, reject) {
        setTimeout(() => {
            console.log("hello delay 1000")
            resolve()
        }, 1000);
    })
}


function runAsync(fn) {
    return new Promise(function(resolve, reject) {
        const runner = fn()
        const next = function(data) {
            const res = runner.next(data);
            if (res.done) {
                return resolve(res.value)
            }
            res.value.then(function(data) {
                next(data)
            })
        }
        next()
    })
}


runAsync(function* () {
    yield delayGreet()
    yield runAsync(function* () {
        yield delayGreet()
        yield delayGreet()
    })
    yield delayGreet()
    yield delayGreet()
})
