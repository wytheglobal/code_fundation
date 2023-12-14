import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";
import replace from "@rollup/plugin-replace";
import eslint from "@rollup/plugin-eslint";

export default {
  input: "src/main.jsx",
  output: {
    file: "public/bundle.js",
    format: "iife",
  },
  plugins: [
    eslint({

    }),
    nodeResolve({
      extensions: [".js", ".jsx"],
    }),
    babel({
      babelHelpers: "bundled",
      presets: ["@babel/preset-react"],
      extensions: [".js", ".jsx"],
    }),
    commonjs(),
    replace({
      preventAssignment: false,
      "process.env.NODE_ENV": '"development"',
    }),
  ],
};
