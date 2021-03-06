/* eslint-disable no-param-reassign */
/* eslint-disable no-continue */
import React from 'react';
import CSSselect from 'css-select';
import { camelize } from './utils';
import {
  getAdapter,
  getTagAndPropsFromSelector,
  parseCSSString,
  parseCSSObject,
  stringifyCSS,
} from './css';

function indexParents(parent, children, map = new Map()) {
  React.Children.forEach(children, child => {
    if (!child) return;

    map.set(child, parent);

    if (child.props) {
      indexParents(child, child.props.children, map);
    }
  });

  return map;
}

function applyStyles(elem, rules, config) {
  if (!React.isValidElement(elem)) {
    return elem;
  }

  const { styleId, globalStyles, adapter, inline, replace } = config;
  const { children } = elem.props;
  const className = replace ? styleId : `${elem.props.className || ''} ${styleId}`.trim();
  const elemStyles = {};

  rules.forEach(rule => {
    try {
      let { selector } = rule;
      let pseudo;

      if (selector.indexOf(':')) {
        [selector, pseudo] = selector.split(/::?/);
      }

      if (CSSselect.is(elem, selector, { adapter })) {
        if (pseudo) {
          globalStyles[rule.at || 'root'] = globalStyles[rule.at || 'root'] || {};
          globalStyles[rule.at || 'root'][`${styleId}:${pseudo}`] = {
            ...globalStyles[rule.at || 'root'][`${styleId}:${pseudo}`] || {},
            ...rule.style,
          };
        } else if (inline) {
          if (rule.at) return;
          elemStyles.root = elemStyles.root || {};
          Object.entries(rule.style).forEach(([k, v]) => { elemStyles.root[camelize(k)] = v; });
        } else {
          elemStyles[rule.at || 'root'] = elemStyles[rule.at || 'root'] || {};
          Object.assign(elemStyles[rule.at || 'root'], rule.style);
        }
      }
    } catch (err) {
      //
    }
  });

  const newProps = {};

  Object.keys(elemStyles).forEach(at => {
    const style = elemStyles[at];

    globalStyles[at] = globalStyles[at] || {};
    globalStyles[at][styleId] = style;

    if (inline) {
      newProps.style = elem.props.style ? Object.assign(style, elem.props.style) : style;

      if (replace) {
        newProps.className = null;
      }
    } else {
      newProps.className = className;
    }
  });

  if (children) {
    newProps.children = React.Children.map(children, (child, idx) => applyStyles(child, rules, {
      ...config,
      styleId: `${styleId}_${idx}`,
    }));
  }

  return React.cloneElement(elem, newProps);
}

export default function StyleSheet(...args) {
  const isObject = Object.prototype.toString.call(args[0]) === '[object Object]';
  const rules = isObject ? parseCSSObject(args[0]) : parseCSSString(String.raw(...args));
  const styleElement = document.createElement('style');
  const styleSheetId = Math.random().toString(36).slice(2);

  styleElement.id = styleSheetId;

  const hoc = ({ children, inline, replace }) => {
    const adapter = getAdapter(indexParents({ props: { children } }, children));
    const globalStyles = {};

    const result = React.Children.map(children, (child, idx) => applyStyles(child, rules, {
      styleId: `_${styleSheetId}_${idx}`,
      globalStyles,
      adapter,
      inline,
      replace,
    }));

    if (!inline) {
      const css = Object.entries(globalStyles).map(([at, styles]) => (
        at === 'root' ? stringifyCSS(styles) : `@${at}{${stringifyCSS(styles)}}`
      )).join('');

      styleElement.innerHTML = css;

      if (!styleElement.parent) {
        document.querySelector('head').appendChild(styleElement);
      }
    }

    React.useEffect(() => (
      inline ? undefined : () => document.querySelector('head').removeChild(styleElement)
    ), [inline]);

    return result;
  };

  hoc.styled = selector => {
    const style = {};
    const adapter = getAdapter();
    const { tagName, props } = getTagAndPropsFromSelector(selector);

    rules.forEach(rule => {
      try {
        const elem = { type: tagName, props: { ...props } };

        if (CSSselect.is(elem, rule.selector, { adapter })) {
          Object.entries(rule.style).forEach(([k, v]) => { style[camelize(k)] = v; });
        }
      } catch (err) {
        //
      }
    });

    return ownProps => React.createElement(tagName, { ...props, style, ...ownProps });
  };

  return hoc;
}
