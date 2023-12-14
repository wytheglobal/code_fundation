import Didact from "./didact";

/** @jsx Didact.createElement */
function Counter() {
  const [state, setState] = Didact.useState(1)
  return (
    <h1 onClick={() => setState(c => c + 1)}>
      Count: {state}
    </h1>
  )
}
const element = <Counter />
const container = document.getElementById("root")
Didact.render(element, container)

// const container = document.getElementById("root")

// const updateValue = e => {
//   rerender(e.target.value)
// };

// const rerender = value => {
//   const element = (
//     <div>
//       <input onInput={updateValue} value={value} />
//       <h2>Hello {value}</h2>
//       <test>
//         <a href=""></a>
//         <b></b>
//         <c></c>
//       </test>
//     </div>
//   )
//   Didact.render(element, container)
// };

// rerender("World");
