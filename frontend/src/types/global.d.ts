/// <reference types="react" />
/// <reference types="react-dom" />
/// <reference types="node" />

// Fallbacks for environments where type resolution isn't available during lint
declare module 'react/jsx-runtime' {
  const jsxRuntime: any;
  export default jsxRuntime;
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare const process: any;

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}


