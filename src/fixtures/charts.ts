import { parseKey } from '../domain/chord'
import { idSequence, type Song } from '../domain/song'
import { fromChordPro } from '../domain/chordpro'

const ids = idSequence('fixture')

/** Public-domain Newton hymn with a traditional hymnal harmony. Not a modern arrangement. */
export const amazingGrace: Song = fromChordPro(
  `{title: Amazing Grace}
{artist: John Newton}
{key: G}
{time: 3/4}
{start_of_verse: Verse 1}
[G]Amazing [G7]grace, how [C]sweet the [G]sound
That [Em]saved a [A7]wretch like [D]me
I [G]once was [G7]lost, but [C]now am [G]found
Was [G]blind but [D7]now I [G]see
{end_of_verse}
{start_of_verse: Verse 2}
'Twas [G]grace that [G7]taught my [C]heart to [G]fear
And [Em]grace my [A7]fears re[D]lieved
How [G]precious [G7]did that [C]grace ap[G]pear
The [G]hour I [D7]first be[G]lieved
{end_of_verse}
{start_of_verse: Verse 3}
The [G]Lord has [G7]promised [C]good to [G]me
His [Em]word my [A7]hope se[D]cures
He [G]will my [G7]shield and [C]portion [G]be
As [G]long as [D7]life en[G]dures
{end_of_verse}
{start_of_verse: Verse 4}
The [G]earth shall [G7]soon dis[C]solve like [G]snow
The [Em]sun for[A7]bear to [D]shine
But [G]God, who [G7]called me [C]here be[G]low
Will [G]be for[D7]ever [G]mine
{end_of_verse}`,
  ids,
)

/** Original chart written for tests. */
export const firstLight: Song = fromChordPro(
  `{title: First Light}
{artist: Original demo}
{key: G}
{tempo: 96}
{time: 4/4}
{start_of_verse: Intro}
| G - - - | D/F# - - - | Em - - - | C - - - |
{comment: Easy, unhurried}
{end_of_verse}
{start_of_verse: Verse 1}
[G]Morning on the [D]kitchen [Em]table
[C]Kettle sings a [G]thin old [D]song
{end_of_verse}
{start_of_chorus: Chorus}
[C]Leave the [G]light on [D]down the hall
[Em]We will [C]find the [G]door
{end_of_chorus}`,
  idSequence('light'),
)

export const sampleKey = parseKey('G')
