mark 设置了 GeneratorFunction 的 prototype

wrap 根据设置的 GeneratorFunction prototype 生成 generator 实例，传入 context 


IteratorPrototype 


```
GeneratorFunctionPrototype
```


context 和传入的函数一起

```javascript
defineProperty(generator, "_invoke", { value: makeInvokeMethod(innerFn, self, context) });
```

.next()

```
defineIteratorMethods
```

`defineIteratorMethods` 添加 "next", "throw", "return" 方法，底层调用 `this._invoke(method, arg);`



