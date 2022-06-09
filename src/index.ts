type Search = RegExp | string
type Rule = [RegExp, string]
type IrregularMap = Map<string, string>

// Rule storage - pluralize and singularize need to be run sequentially,
// while other rules can be optimized using an object for instant lookups.
var pluralRules: Rule[] = []
var singularRules: Rule[] = []
const uncountables = new Set<string>()
var irregularPlurals: IrregularMap = new Map()
var irregularSingles: IrregularMap = new Map()

/**
 * Sanitize a pluralization rule to a usable regular expression.
 */
const sanitizeRule = (rule: Search): RegExp => {
  if (typeof rule === 'string') {
    return new RegExp('^' + rule + '$', 'i')
  }

  return rule
}

/**
 * Pass in a word token to produce a function that can replicate the case on
 * another word.
 */
const restoreCase = (word: string, token: string | undefined): string => {
  // Edge case
  if (typeof token !== 'string') return word
  // Tokens are an exact match.
  if (word === token) return token

  // Lower cased words. E.g. "hello".
  if (word === word.toLowerCase()) return token.toLowerCase()

  // Upper cased words. E.g. "WHISKY".
  if (word === word.toUpperCase()) return token.toUpperCase()

  // Title cased words. E.g. "Title".
  if (word[0] === word[0].toUpperCase()) {
    return token.charAt(0).toUpperCase() + token.substr(1).toLowerCase()
  }

  // Lower cased words. E.g. "test".
  return token.toLowerCase()
}

/**
 * Interpolate a regexp string.
 *
 * @param  {string} str
 * @param  {Array}  args
 * @return {string}
 */
function interpolate(str: string, args) {
  return str.replace(/\$(\d{1,2})/g, function (match, index) {
    return args[index] || ''
  })
}

/**
 * Replace a word using a rule.
 *
 * @param  {string} word
 * @param  {Array}  rule
 * @return {string}
 */
const replace = (word: string, rule: Rule): string => {
  return word.replace(rule[0], function (match, index) {
    var result = interpolate(rule[1], arguments)

    if (match === '') {
      return restoreCase(word[index - 1], result)
    }

    return restoreCase(match, result)
  })
}

/**
 * Sanitize a word by passing in the word and sanitization rules.
 */
function sanitizeWord(token: string, word: string, rules: Rule[]): word {
  // Empty string or doesn't need fixing.
  if (!token.length || uncountables.has(token)) {
    return word
  }

  var len = rules.length

  // Iterate over the sanitization rules and use the first one to match.
  while (len--) {
    var rule = rules[len]

    if (rule[0].test(word)) return replace(word, rule)
  }

  return word
}

const compute = (
  word: string,
  replaceMap: IrregularMap,
  keepMap: IrregularMap,
  rules: Rule[]
): string => {
  // Get the correct token and case restoration functions.
  var token = word.toLowerCase()

  // Check against the keep object map.
  if (keepMap.has(token)) {
    return restoreCase(word, token)
  }

  // Check against the replacement map for a direct word replacement.
  if (replaceMap.has(token)) {
    return restoreCase(word, replaceMap.get(token))
  }

  // Run all the rules against the word.
  return sanitizeWord(token, word, rules)
}

/**
 * Check if a word is part of the map.
 */
function checkWord(replaceMap, keepMap, rules, bool?: boolean) {
  return function (word: string) {
    var token = word.toLowerCase()

    if (keepMap.has(token)) return true
    if (replaceMap.has(token)) return false

    return sanitizeWord(token, token, rules) === token
  }
}

/**
 * Pluralize or singularize a word based on the passed in count.
 *
 * @param word
 * @param count
 * @param inclusive
 */
const pluralize = (
  word: string,
  count?: number,
  inclusive?: boolean
): string => {
  var pluralized =
    count === 1 ? pluralize.singular(word) : pluralize.plural(word)

  return (inclusive ? count + ' ' : '') + pluralized
}

/**
 * Pluralize a word based.
 *
 * @param word
 */
pluralize.plural = (word: string): string =>
  compute(word, irregularSingles, irregularPlurals, pluralRules)

/**
 * Singularize a word based.
 *
 * @param word
 */
pluralize.singular = (word: string): string =>
  compute(word, irregularPlurals, irregularSingles, singularRules)

/**
 * Add a pluralization rule to the collection.
 *
 * @param rule
 * @param replacement
 */
pluralize.addPluralRule = (
  rule: string | RegExp,
  replacement: string
): void => {
  pluralRules.push([sanitizeRule(rule), replacement])
}

/**
 * Add a singularization rule to the collection.
 *
 * @param rule
 * @param replacement
 */
pluralize.addSingularRule = (
  rule: string | RegExp,
  replacement: string
): void => {
  singularRules.push([sanitizeRule(rule), replacement])
}

/**
 * Add an irregular word definition.
 *
 * @param single
 * @param plural
 */
pluralize.addIrregularRule = (single: string, plural: string): void => {
  plural = plural.toLowerCase()
  single = single.toLowerCase()

  irregularSingles.set(single, plural)
  irregularPlurals.set(plural, single)
}

/**
 * Add an uncountable word rule.
 *
 * @param word
 */
pluralize.addUncountableRule = (word: string | RegExp): void => {
  if (typeof word === 'string') {
    uncountables.add(word.toLowerCase())
    return
  }

  // Set singular and plural references for the word.
  pluralize.addPluralRule(word, '$0')
  pluralize.addSingularRule(word, '$0')
}

/**
 * Test if provided word is plural.
 *
 * @param word
 */
pluralize.isPlural = checkWord(irregularSingles, irregularPlurals, pluralRules)

/**
 * Test if provided word is singular.
 *
 * @param word
 */
pluralize.isSingular = checkWord(
  irregularPlurals,
  irregularSingles,
  singularRules
)

const defaultIrregulars: [string, string][] = [
  // Pronouns.
  ['I', 'we'],
  ['me', 'us'],
  ['he', 'they'],
  ['she', 'they'],
  ['them', 'them'],
  ['myself', 'ourselves'],
  ['yourself', 'yourselves'],
  ['itself', 'themselves'],
  ['herself', 'themselves'],
  ['himself', 'themselves'],
  ['themself', 'themselves'],
  ['is', 'are'],
  ['was', 'were'],
  ['has', 'have'],
  ['this', 'these'],
  ['that', 'those'],
  ['my', 'our'],
  ['its', 'their'],
  ['his', 'their'],
  ['her', 'their'],
  // Words ending in with a consonant and `o`.
  ['echo', 'echoes'],
  ['dingo', 'dingoes'],
  ['volcano', 'volcanoes'],
  ['tornado', 'tornadoes'],
  ['torpedo', 'torpedoes'],
  // Ends with `us`.
  ['genus', 'genera'],
  ['viscus', 'viscera'],
  // Ends with `ma`.
  ['stigma', 'stigmata'],
  ['stoma', 'stomata'],
  ['dogma', 'dogmata'],
  ['lemma', 'lemmata'],
  ['schema', 'schemata'],
  ['anathema', 'anathemata'],
  // Other irregular rules.
  ['ox', 'oxen'],
  ['axe', 'axes'],
  ['die', 'dice'],
  ['yes', 'yeses'],
  ['foot', 'feet'],
  ['eave', 'eaves'],
  ['goose', 'geese'],
  ['tooth', 'teeth'],
  ['quiz', 'quizzes'],
  ['human', 'humans'],
  ['proof', 'proofs'],
  ['carve', 'carves'],
  ['valve', 'valves'],
  ['looey', 'looies'],
  ['thief', 'thieves'],
  ['groove', 'grooves'],
  ['pickaxe', 'pickaxes'],
  ['passerby', 'passersby'],
  ['canvas', 'canvases'],
]
const defaultPlurals: [Search, string][] = [
  [/s?$/i, 's'],
  [/[^\u0000-\u007F]$/i, '$0'],
  [/([^aeiou]ese)$/i, '$1'],
  [/(ax|test)is$/i, '$1es'],
  [/(alias|[^aou]us|t[lm]as|gas|ris)$/i, '$1es'],
  [/(e[mn]u)s?$/i, '$1s'],
  [/([^l]ias|[aeiou]las|[ejzr]as|[iu]am)$/i, '$1'],
  [
    /(alumn|syllab|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i,
    '$1i',
  ],
  [/(alumn|alg|vertebr)(?:a|ae)$/i, '$1ae'],
  [/(seraph|cherub)(?:im)?$/i, '$1im'],
  [/(her|at|gr)o$/i, '$1oes'],
  [
    /(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|automat|quor)(?:a|um)$/i,
    '$1a',
  ],
  [
    /(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)(?:a|on)$/i,
    '$1a',
  ],
  [/sis$/i, 'ses'],
  [/(?:(kni|wi|li)fe|(ar|l|ea|eo|oa|hoo)f)$/i, '$1$2ves'],
  [/([^aeiouy]|qu)y$/i, '$1ies'],
  [/([^ch][ieo][ln])ey$/i, '$1ies'],
  [/(x|ch|ss|sh|zz)$/i, '$1es'],
  [/(matr|cod|mur|sil|vert|ind|append)(?:ix|ex)$/i, '$1ices'],
  [/\b((?:tit)?m|l)(?:ice|ouse)$/i, '$1ice'],
  [/(pe)(?:rson|ople)$/i, '$1ople'],
  [/(child)(?:ren)?$/i, '$1ren'],
  [/eaux$/i, '$0'],
  [/m[ae]n$/i, 'men'],
  ['thou', 'you'],
]
const defaultSingles: [Search, string][] = [
  [/s$/i, ''],
  [/(ss)$/i, '$1'],
  [/(wi|kni|(?:after|half|high|low|mid|non|night|[^\w]|^)li)ves$/i, '$1fe'],
  [/(ar|(?:wo|[ae])l|[eo][ao])ves$/i, '$1f'],
  [/ies$/i, 'y'],
  [/(dg|ss|ois|lk|ok|wn|mb|th|ch|ec|oal|is|ck|ix|sser|ts|wb)ies$/i, '$1ie'],
  [
    /\b(l|(?:neck|cross|hog|aun)?t|coll|faer|food|gen|goon|group|hipp|junk|vegg|(?:pork)?p|charl|calor|cut)ies$/i,
    '$1ie',
  ],
  [/\b(mon|smil)ies$/i, '$1ey'],
  [/\b((?:tit)?m|l)ice$/i, '$1ouse'],
  [/(seraph|cherub)im$/i, '$1'],
  [
    /(x|ch|ss|sh|zz|tto|go|cho|alias|[^aou]us|t[lm]as|gas|(?:her|at|gr)o|[aeiou]ris)(?:es)?$/i,
    '$1',
  ],
  [
    /(analy|diagno|parenthe|progno|synop|the|empha|cri|ne)(?:sis|ses)$/i,
    '$1sis',
  ],
  [/(movie|twelve|abuse|e[mn]u)s$/i, '$1'],
  [/(test)(?:is|es)$/i, '$1is'],
  [
    /(alumn|syllab|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i,
    '$1us',
  ],
  [
    /(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|quor)a$/i,
    '$1um',
  ],
  [
    /(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)a$/i,
    '$1on',
  ],
  [/(alumn|alg|vertebr)ae$/i, '$1a'],
  [/(cod|mur|sil|vert|ind)ices$/i, '$1ex'],
  [/(matr|append)ices$/i, '$1ix'],
  [/(pe)(rson|ople)$/i, '$1rson'],
  [/(child)ren$/i, '$1'],
  [/(eau)x?$/i, '$1'],
  [/men$/i, 'man'],
]
const defaultUncountables: Search[] = [
  // Singular words with no plurals.
  'adulthood',
  'advice',
  'agenda',
  'aid',
  'aircraft',
  'alcohol',
  'ammo',
  'analytics',
  'anime',
  'athletics',
  'audio',
  'bison',
  'blood',
  'bream',
  'buffalo',
  'butter',
  'carp',
  'cash',
  'chassis',
  'chess',
  'clothing',
  'cod',
  'commerce',
  'cooperation',
  'corps',
  'debris',
  'diabetes',
  'digestion',
  'elk',
  'energy',
  'equipment',
  'excretion',
  'expertise',
  'firmware',
  'flounder',
  'fun',
  'gallows',
  'garbage',
  'graffiti',
  'hardware',
  'headquarters',
  'health',
  'herpes',
  'highjinks',
  'homework',
  'housework',
  'information',
  'jeans',
  'justice',
  'kudos',
  'labour',
  'literature',
  'machinery',
  'mackerel',
  'mail',
  'media',
  'mews',
  'moose',
  'music',
  'mud',
  'manga',
  'news',
  'only',
  'personnel',
  'pike',
  'plankton',
  'pliers',
  'police',
  'pollution',
  'premises',
  'rain',
  'research',
  'rice',
  'salmon',
  'scissors',
  'series',
  'sewage',
  'shambles',
  'shrimp',
  'software',
  'staff',
  'swine',
  'tennis',
  'traffic',
  'transportation',
  'trout',
  'tuna',
  'wealth',
  'welfare',
  'whiting',
  'wildebeest',
  'wildlife',
  'you',
  /pok[eé]mon$/i,
  // Regexes.
  /[^aeiou]ese$/i, // "chinese", "japanese"
  /deer$/i, // "deer", "reindeer"
  /fish$/i, // "fish", "blowfish", "angelfish"
  /measles$/i,
  /o[iu]s$/i, // "carnivorous"
  /pox$/i, // "chickpox", "smallpox"
  /sheep$/i,
]
// Now lets add all the defaults
for (const [single, plural] of defaultIrregulars) {
  pluralize.addIrregularRule(single, plural)
}
for (const [search, replacement] of defaultPlurals) {
  pluralize.addPluralRule(search, replacement)
}
for (const [search, replacement] of defaultSingles) {
  pluralize.addSingularRule(search, replacement)
}
for (const search of defaultUncountables) {
  pluralize.addUncountableRule(search)
}

// D O N E, let's export! 😗
export default pluralize
