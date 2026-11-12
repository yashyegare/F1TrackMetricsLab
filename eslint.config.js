import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
export default [
  {ignores:['dist/','node_modules/']},
  {...js.configs.recommended,files:['src/**/*.{js,jsx,ts,tsx}']},
  {
    files:['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions:{
      parser:tseslint.parser,parserOptions:{ecmaFeatures:{jsx:true}},ecmaVersion:'latest',sourceType:'module',
      globals:Object.fromEntries(['window','document','console','fetch','setTimeout','clearTimeout','setInterval','clearInterval','localStorage','sessionStorage','URLSearchParams','URL','performance','requestAnimationFrame','cancelAnimationFrame','navigator','Image','HTMLCanvasElement','WebGLRenderingContext','ClipboardItem','self','Worker','AbortController','DOMException','describe','test','it','expect','vi','beforeEach','afterEach'].map(name => [name,'readonly']))
    },
    plugins:{'react-hooks':reactHooks,'@typescript-eslint':tseslint.plugin},
    rules:{
      'react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'error','no-undef':'error','no-unused-vars':'off',
      '@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^React$',caughtErrorsIgnorePattern:'^_'}]
    }
  },
  {files:['src/**/*.{ts,tsx}'],rules:{'no-undef':'off'}}
];
