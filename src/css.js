import React from 'react';
import CSSwhat from 'css-what';
import { camelizeAttr, decamelize } from './utils';

function weight(selector) {
  const ids = (selector.match(/#/g) || []).length;
  const attrs = (selector.match(/\.|\[[^]+\]/g) || []).length;
  const tags = (selector.match(/(^|\s)[a-z]/g) || []).length;

  return ids * 100 + attrs * 10 + tags;
}

export function getAdapter(_parents) {
  return {
    isTag: node => !!node.type,
    existsOne: (test, elems) => elems.some(test),
    getAttributeValue: (elem, name) => elem.props[camelizeAttr(name)],
    getChildren: node => {
      const children = [];

      React.Children.forEach(node.props.children, child => child && children.push(child));

      return children;
    },
    getName: elem => elem.type,
    getParent: node => _parents.get(node),
    getSiblings: node => {
      const siblings = [];
      const parent = _parents.get(node);

      React.Children.forEach(parent.props.children, child => child && siblings.push(child));

      return siblings;
    },
    getText: node => {
      const text = [];

      React.Children.forEach(node.props.children, child => {
        if (typeof child === 'string') text.push(child);
      });

      return text.join(' ');
    },
    hasAttrib: (elem, name) => name in elem.props,
    removeSubsets: nodes => {
      let idx = nodes.length;

      while (--idx >= 0) {
        const node = nodes[idx];

        if (idx > 0 && nodes.lastIndexOf(node, idx - 1) >= 0) {
          nodes.splice(idx, 1);
          continue;
        }

        for (let ancestor = _parents.get(node); ancestor; ancestor = _parents.get(ancestor)) {
          if (nodes.indexOf(ancestor) > -1) {
            nodes.splice(idx, 1);
            break;
          }
        }
      }

      return nodes;
    },
    findAll: (test, nodes) => {
      const matched = [];
      const stack = nodes.slice();

      while (stack.length) {
        const elem = stack.shift();

        if (!elem || !elem.type) continue;

        const children = [];

        React.Children.forEach(elem.props.children, child => child && children.push(child));

        stack.unshift(...children);

        if (test(elem)) matched.push(elem);
      }

      return matched;
    },
    findOne: (test, elems) => {
      let matched = null;

      elems.some(node => {
        if (test(node)) {
          matched = node;
          return true;
        }

        React.Children.forEach(node.props.children, child => {
          if (!matched && test(child)) matched = child;
        });

        return false;
      });

      return matched;
    },
    // equals: (a, b) => a === b,
  };
}

export function getTagAndPropsFromSelector(selector) {
  const parts = CSSwhat(selector).shift();
  const props = {};
  let tagName = 'div';

  parts.forEach(part => {
    switch (part.type) {
      case 'tag': tagName = part.name; break;
      case 'attribute': props[camelizeAttr(part.name)] = part.value; break;
      default: throw new Error('Invalid selector');
    }
  });

  return {
    tagName,
    props,
  };
}

export function parseCSSObject(object) {
  const rules = [];

  Object.entries(object).forEach(([selector, style]) => {
    selector.split(',').forEach(s => {
      rules.push({
        selector: s.trim(),
        weight: weight(s),
        style,
      });
    });
  });

  return rules.sort((a, b) => a.weight - b.weight);
}

export function parseCSSString(css) {
  const rules = [];

  css.split(/}\s*/).forEach(rule => {
    const [selector, declarations] = rule.split(/\s*{\s*/);
    if (!selector || !declarations) return;
    const style = {};

    declarations.split(/\s*;\s*/).forEach(declaration => {
      const parts = declaration.split(':');
      const attr = parts.shift().trim();
      const value = parts.join(':').trim();

      if (attr && value) style[attr] = value;
    });

    selector.split(',').forEach(s => {
      rules.push({
        selector: s.trim(),
        weight: weight(s),
        style,
      });
    });
  });

  return rules.sort((a, b) => a.weight - b.weight);
}

export function stringifyCSS(css) {
  return Object.entries(css).map(([className, styles]) => (
    `.${className}{${Object.entries(styles).map(([k, v]) => `${decamelize(k)}:${v}`).join(';')}}`
  )).join('');
}
