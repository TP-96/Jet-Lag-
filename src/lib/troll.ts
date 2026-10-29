// Built-in "trolling items" that work with zero setup.
export interface TrollAction {
  id: 'airhorn' | 'buzz' | 'trombone' | 'fakeping' | 'confetti' | 'ominous';
  label: string;
  icon: string;
  description: string;
}

export const TROLL_ACTIONS: TrollAction[] = [
  { id: 'airhorn', label: 'Air horn', icon: '📯', description: "Blasts an air horn on everyone's phone" },
  { id: 'buzz', label: 'Buzz', icon: '📳', description: 'Vibrates phones and shakes the screen' },
  { id: 'trombone', label: 'Sad trombone', icon: '🎺', description: 'Wah wah wahhh' },
  { id: 'fakeping', label: '"I see you"', icon: '👀', description: 'Full-screen "I SEE YOU" flash' },
  { id: 'confetti', label: 'Confetti', icon: '🎉', description: 'Celebrate (sarcastically)' },
  { id: 'ominous', label: 'Ominous', icon: '🕯️', description: 'A creepy curse sound' },
];

// Big stickers: emoji art and catchphrases in the spirit of the show.
export const STICKERS: { id: string; text: string; sub?: string }[] = [
  { id: 'cold', text: '🥶', sub: "you're ice cold" },
  { id: 'hot', text: '🔥', sub: 'getting warmer…' },
  { id: 'clown', text: '🤡', sub: 'seeker strategy' },
  { id: 'snail', text: '🐌', sub: 'your pace rn' },
  { id: 'eyes', text: '👀' },
  { id: 'skull', text: '💀' },
  { id: 'train', text: '🚆💨', sub: 'missed it' },
  { id: 'bus', text: '🚌❌', sub: 'not in service' },
  { id: 'map', text: '🗺️❓', sub: 'lost?' },
  { id: 'clock', text: '⏰', sub: 'tick tock' },
  { id: 'chef', text: '🧑‍🍳💋', sub: 'perfect hiding spot' },
  { id: 'cry', text: '😭', sub: 'curse incoming' },
  { id: 'nerd', text: '🤓☝️', sub: 'well actually' },
  { id: 'trophy', text: '🏆', sub: 'gg' },
  { id: 'ghost', text: '👻', sub: "can't find me" },
  { id: 'detective', text: '🕵️', sub: 'on your trail' },
  { id: 'lemon', text: '🍋', sub: 'phylactery time' },
  { id: 'egg', text: '🥚', sub: "don't drop it" },
  { id: 'rock', text: '🪨🪨🪨', sub: 'build a cairn' },
  { id: 'dice', text: '🎲', sub: 'roll for it' },
];

export const QUICK_REACTIONS = ['😂', '🔥', '💀', '👀', '🤡', '❤️'];
