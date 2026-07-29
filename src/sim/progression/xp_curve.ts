// The base-level experience curve, transcribed.
//
// From `GameServerConfig.asset::ExpRequirement` as published in
// docs/design/data/spiritvale-raw/mechanics.json. Entry `i` is the experience
// needed to go from level `i + 1` to `i + 2`, so the array is read exactly the
// way the table it replaces was.
//
// The published array carries 161 entries against a cap of 150; the extra eleven
// sit past the cap and are dropped here. The last entry kept is the step OUT of
// the cap, which no character takes: it is the post-cap prestige unit, the same
// role the previous table's last entry had.
//
// The curve this replaces was CONSTRUCTED, a base step multiplied through
// twenty-odd hand-fitted growth bands to approximate the reference's shape. This
// one IS the reference's shape, so the bands are gone.
//
// Its own arithmetic is worth noticing: the per-level ratio falls smoothly from
// 4.9 at the bottom to about 1.047 by level 130, then RISES again to 1.16 by
// 150. The last twenty levels get harder, which lines up exactly with the
// attribute bands paying LESS over the same stretch (progression/attributes.ts).

export const SPIRITVALE_XP_CURVE: readonly number[] = [
  40,
  196,
  500,
  970,
  1620, // 1 to 5
  2464,
  3513,
  4777,
  6263,
  7981, // 6 to 10
  10007,
  12534,
  15683,
  19544,
  24193, // 11 to 15
  29698,
  36120,
  43516,
  51939,
  61439, // 16 to 20
  72062,
  83854,
  96858,
  111114,
  126662, // 21 to 25
  143541,
  161788,
  181439,
  202528,
  225090, // 26 to 30
  249218,
  275153,
  303103,
  333247,
  365747, // 31 to 35
  400756,
  438418,
  478873,
  522253,
  568688, // 36 to 40
  618302,
  671218,
  727553,
  787424,
  850945, // 41 to 45
  918226,
  989378,
  1064507,
  1143718,
  1227117, // 46 to 50
  1314864,
  1407330,
  1504900,
  1607946,
  1716827, // 51 to 55
  1831894,
  1953495,
  2081968,
  2217650,
  2360872, // 56 to 60
  2511963,
  2671247,
  2839047,
  3015681,
  3201466, // 61 to 65
  3396716,
  3601743,
  3816857,
  4042364,
  4278572, // 66 to 70
  4525844,
  4784816,
  5056234,
  5340867,
  5639499, // 71 to 75
  5952924,
  6281947,
  6627379,
  6990037,
  7370743, // 76 to 80
  7770326,
  8189616,
  8629450,
  9090666,
  9574106, // 81 to 85
  10080615,
  10611042,
  11166236,
  11747051,
  12354341, // 86 to 90
  12989023,
  13652368,
  14345896,
  15071245,
  15830142, // 91 to 95
  16624379,
  17455812,
  18326346,
  19237936,
  20192578, // 96 to 100
  21192310,
  22239204,
  23335366,
  24482938,
  25684090, // 101 to 105
  26941022,
  28255960,
  29631160,
  31068902,
  32571490, // 106 to 110
  34141312,
  35781216,
  37494524,
  39284872,
  41156140, // 111 to 115
  43112432,
  45158048,
  47297468,
  49535336,
  51876460, // 116 to 120
  54325792,
  56888432,
  59569604,
  62374676,
  65309128, // 121 to 125
  68378576,
  71588736,
  74945448,
  78454672,
  82122456, // 126 to 130
  85955016,
  89960368,
  94153872,
  98565376,
  103246448, // 131 to 135
  108277536,
  113775176,
  119899208,
  126859944,
  134925408, // 136 to 140
  144428464,
  155774096,
  169446576,
  186016640,
  206148704, // 141 to 145
  230608064,
  260268096,
  296117472,
  339267296,
  390958368, // 146 to 150
];

/** The base level a character cannot pass. */
export const SPIRITVALE_MAX_LEVEL = 150;
