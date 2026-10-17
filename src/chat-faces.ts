// Faces for the message window, flat colour like the rest of the game, each told apart by its outline at a glance.

const SKIN = '#f2c9a0';
const wrap = (bg: string, body: string) =>
  `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="24" fill="${bg}"/><g>${body}</g></svg>`;
const eyes = (y: number, color = '#2b2b2b') => `<circle cx="19" cy="${y}" r="1.8" fill="${color}"/><circle cx="29" cy="${y}" r="1.8" fill="${color}"/>`;

export const FACES = {
  // The driver as seen in the game: a white round head under a red cap with its peak.
  me: wrap('#7fb8e6', `
    <path d="M10 48c1-9 7-13 14-13s13 4 14 13z" fill="#e9eef3"/>
    <circle cx="24" cy="25" r="11" fill="#fbfdff"/>
    <path d="M12.5 21a11.5 10 0 0 1 23 0z" fill="#d8352f"/>
    <path d="M22 21h16.5a2 2 0 0 1 0 3H22z" fill="#b52823"/>
    ${eyes(27, '#33404d')}
    <path d="M21 31.5q3 2 6 0" stroke="#33404d" stroke-width="1.4" fill="none" stroke-linecap="round"/>`),
  // The boss: middle-aged, bald on top with hair at the sides, heavy brows, a polo collar.
  boss: wrap('#f0b85a', `
    <path d="M8 48c1-10 8-14 16-14s15 4 16 14z" fill="#2f6f4f"/>
    <path d="M18 34l6 6 6-6-2-1-4 4-4-4z" fill="#fff"/>
    <circle cx="24" cy="23" r="11.5" fill="${SKIN}"/>
    <path d="M12.6 24c-1.5-6 0-9 2.6-10 .3 4 .2 7-.4 10zM35.4 24c1.5-6 0-9-2.6-10-.3 4-.2 7 .4 10z" fill="#3a3330"/>
    <path d="M16 19.5l6 1M32 19.5l-6 1" stroke="#2b2422" stroke-width="2.6" stroke-linecap="round"/>
    ${eyes(23)}
    <path d="M19 29.5q5-2 10 0" stroke="#2b2422" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M20 27.5q4 1.5 8 0" stroke="#3a3330" stroke-width="1.6" fill="none"/>`),
  // A student: a mop of black hair, round glasses, a hoodie.
  student: wrap('#9b8fe0', `
    <path d="M9 48c1-10 7-14 15-14s14 4 15 14z" fill="#5b6b7d"/>
    <circle cx="24" cy="25" r="11" fill="${SKIN}"/>
    <path d="M12 24c-2-9 4-15 12-15s15 5 12 15c-1-3-2-5-4-6-2 2-5 2-8 1-2 2-5 3-8 2-2 1-3 2-4 3z" fill="#1f1d24"/>
    <circle cx="19" cy="26" r="3.6" fill="none" stroke="#222" stroke-width="1.4"/>
    <circle cx="29" cy="26" r="3.6" fill="none" stroke="#222" stroke-width="1.4"/>
    <path d="M22.6 26h2.8" stroke="#222" stroke-width="1.4"/>
    ${eyes(26)}
    <path d="M21.5 32q2.5-1.2 5 0" stroke="#7a4b3a" stroke-width="1.4" fill="none" stroke-linecap="round"/>`),
  // The canteen's owner: a tight black perm, one brow up, red lips, a white apron over a red top, a pen behind her ear.
  canteen: wrap('#4fb3a5', `
    <path d="M9 48c1-10 7-14 15-14s14 4 15 14z" fill="#c8372d"/>
    <path d="M16 48v-9q8 4 16 0v9z" fill="#f4f1ea"/>
    <path d="M18 37l1 4M30 37l-1 4" stroke="#f4f1ea" stroke-width="1.6"/>
    <circle cx="24" cy="25" r="11" fill="${SKIN}"/>
    <circle cx="14" cy="18" r="4" fill="#241c1c"/><circle cx="19" cy="13.5" r="4.2" fill="#241c1c"/><circle cx="25" cy="12" r="4.4" fill="#241c1c"/>
    <circle cx="31" cy="14" r="4.2" fill="#241c1c"/><circle cx="35" cy="19" r="4" fill="#241c1c"/><circle cx="13.5" cy="23.5" r="3.2" fill="#241c1c"/><circle cx="35" cy="24.5" r="3.2" fill="#241c1c"/>
    <path d="M36.5 14l3.5 9" stroke="#2f62a8" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M16 21.5l5-.5M27 19.5l5 1.5" stroke="#241c1c" stroke-width="2" stroke-linecap="round"/>
    ${eyes(25)}
    <path d="M20.5 31.5q3.5 1.6 7-.6" stroke="#c0262f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`),
  // The site foreman: a yellow hard hat, an orange vest with its reflective band, stubble.
  foreman: wrap('#6c8a99', `
    <path d="M8 48c1-10 8-14 16-14s15 4 16 14z" fill="#f07a1a"/>
    <path d="M9.5 43h29" stroke="#e8f0f0" stroke-width="2.6"/>
    <circle cx="24" cy="25.5" r="11" fill="#e5b98e"/>
    <path d="M14.5 28c0 6 4 9 9.5 9s9.5-3 9.5-9c-2 3-5 4-9.5 4s-7.5-1-9.5-4z" fill="#8a7a6a" opacity=".55"/>
    <path d="M11 20a13 11 0 0 1 26 0z" fill="#ffcc1a"/>
    <path d="M9 20h30v2.6H9z" fill="#e6b400"/>
    <path d="M23 9.5h2v10.5h-2z" fill="#e6b400"/>
    <path d="M17 25h4M27 25h4" stroke="#2b2b2b" stroke-width="2" stroke-linecap="round"/>
    <path d="M20.5 32h7" stroke="#4a3a30" stroke-width="1.6" stroke-linecap="round"/>`),
};
