export function camelize(string) {
  return string.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}

export function decamelize(string) {
  return string.replace(/[a-z][A-Z]/g, match => `${match[0]}-${match[1].toLowerCase()}`);
}

export function camelizeAttr(string) {
  let camelCased = camelize(string);

  if (camelCased === 'class') camelCased = 'className';
  if (camelCased === 'for') camelCased = 'htmlFor';

  return camelCased;
}
