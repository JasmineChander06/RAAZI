import type {
  CampaignStage,
  CandidateQuestion,
  ClueNode,
  DetectiveCase,
  InvestigationTurn,
  MysteryCategoryId,
  Suspect,
} from '../types/mystery.ts';
import { rankNextQuestions, recomputePosteriorFromEvidence } from '../engine/aiAlgorithms.ts';

export const BLACKWOOD_BANNER = '/src/assets/images/blackwood_manor_murder_1794878589143.jpg';
export const ALEXANDRIA_BANNER = '/src/assets/images/alexandria_observatory_case_1794877118308.jpg';
export const ARCHIVE_BANNER = '/src/assets/images/obsidian_parchment_archive_1794877118440.jpg';

export interface MysteryCategoryMeta {
  id: MysteryCategoryId;
  label: string;
  subtitle: string;
  description: string;
}

export const MYSTERY_CATEGORIES: MysteryCategoryMeta[] = [
  {
    id: 'murder',
    label: 'Murder Mystery',
    subtitle: 'Locked Rooms & Forensic Whodunits',
    description:
      'Solve classic homicides across a storm-swept estate, an opera backstage, and a snowbound alpine train.',
  },
  {
    id: 'ancient',
    label: 'Ancient Mystery',
    subtitle: 'Scrolls, Astrolabes & Lost Empires',
    description:
      'Uncover thefts, ciphers, and court conspiracies inside Baghdad, Alexandria, and the Silk Road.',
  },
  {
    id: 'heist',
    label: 'Heist & Cipher',
    subtitle: 'Vault Breaches & Cryptographic Sabotage',
    description:
      'Track impossible museum swaps, time-lock bank heists, and maritime telegraph espionage.',
  },
];

function buildStageBundle(params: {
  id: string;
  stageId: string;
  stageOrder: number;
  title: string;
  era: string;
  difficulty: 'Novice' | 'Adept' | 'Master';
  synopsis: string;
  settingDetail: string;
  culpritId: string;
  solutionSummary: string;
  bannerImageUrl: string;
  suspects: Suspect[];
  clues: ClueNode[];
  candidateQuestions: CandidateQuestion[];
  openingSituationNote: string;
}): {
  caseData: DetectiveCase;
  clues: ClueNode[];
  messages: InvestigationTurn[];
} {
  const updatedSuspects = recomputePosteriorFromEvidence(params.suspects, params.clues);
  const topSuspect = updatedSuspects[0];
  const initialDecisions = rankNextQuestions(updatedSuspects, params.candidateQuestions);

  const caseData: DetectiveCase = {
    id: params.id,
    ownerId: 'guest',
    stageId: params.stageId,
    stageOrder: params.stageOrder,
    title: params.title,
    era: params.era,
    difficulty: params.difficulty,
    synopsis: params.synopsis,
    settingDetail: params.settingDetail,
    status: 'active',
    suspects: updatedSuspects,
    culpritId: params.culpritId,
    solutionSummary: params.solutionSummary,
    clueCount: params.clues.filter((c) => c.discovered).length,
    turnCount: 1,
    candidateQuestions: params.candidateQuestions,
    bannerImageUrl: params.bannerImageUrl,
  };

  const messages: InvestigationTurn[] = [
    {
      id: `turn_${params.stageId}_intro`,
      ownerId: 'guest',
      caseId: caseData.id,
      role: 'raazi',
      content: `${params.openingSituationNote}\n\nCurrently, ${topSuspect.name} holds the highest prior probability (${(
        topSuspect.posteriorProbability * 100
      ).toFixed(1)}%). Ask me to explain the situation, inspect clues, or say "I accuse [Suspect Name]" once you are ready to solve this stage and unlock the next difficulty on your Case Map.\n\nTop recommended lead: "${
        initialDecisions[0]?.prompt ?? 'Examine the primary physical evidence.'
      }"`,
      nlpIntent: 'initial_briefing',
      topSuspectName: topSuspect.name,
      topProbability: topSuspect.posteriorProbability,
    },
  ];

  return {
    caseData,
    clues: params.clues.map((c) => ({ ...c })),
    messages,
  };
}

/* ==========================================================================
 * TRACK 1: MURDER MYSTERY (EASY -> MEDIUM -> HARD)
 * ========================================================================== */

export function createStage1Blackwood() {
  const stageId = 'murder_1_easy';
  const suspects: Suspect[] = [
    {
      id: 'suspect_julian',
      name: 'Julian Vance',
      role: 'Estate Solicitor',
      motive: 'Lord Blackwood discovered Julian had been embezzling trust funds and planned to report him tomorrow morning.',
      alibi: 'Claims he left the manor gates at 11:15 PM before the thunderstorm broke.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_clara',
      name: 'Clara Blackwood',
      role: 'Estranged Niece',
      motive: 'Recently cut out of Lord Blackwood’s revised will in favor of a charity foundation.',
      alibi: 'States she was reading upstairs in the West Wing guestroom from 10:45 PM onward.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_sterling',
      name: 'Dr. Arthur Sterling',
      role: 'Family Physician',
      motive: 'Owed £12,000 in gambling debts to London creditors and sought a quiet loan.',
      alibi: 'Insists he stayed in the downstairs drawing room playing solitaire by the fire.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_martha',
      name: 'Martha Finch',
      role: 'Head Housekeeper',
      motive: 'Lord Blackwood threatened to dismiss her and sell the estate cottages.',
      alibi: 'Reports she locked the kitchen pantry at 11:00 PM and retired to the servant wing.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
  ];

  const clues: ClueNode[] = [
    {
      id: 'bw_clue_decanter',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Tainted Sherry Decanter',
      detail:
        'Lord Alistair Blackwood collapsed at 11:40 PM from crushed monkshood stirred into his crystal sherry glass. Only someone inside the study after 11:10 PM could have poured it warm.',
      category: 'physical',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['bw_clue_watch', 'bw_clue_mud'],
      likelihoods: {
        suspect_julian: 0.72,
        suspect_clara: 0.52,
        suspect_sterling: 0.64,
        suspect_martha: 0.35,
      },
    },
    {
      id: 'bw_clue_watch',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Gatehouse Logbook Discrepancy',
      detail:
        'The groundskeeper noted the iron gate stayed bolted after 11:00 PM—and no carriage departed during the downpour, contradicting Julian Vance’s claim that he left at 11:15 PM.',
      category: 'alibi',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['bw_clue_decanter', 'bw_clue_monogram'],
      likelihoods: {
        suspect_julian: 0.85,
        suspect_clara: 0.24,
        suspect_sterling: 0.28,
        suspect_martha: 0.22,
      },
    },
    {
      id: 'bw_clue_mud',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Botanical Apothecary Vial',
      detail:
        'A trace of tincture of aconite was wiped from a silver pocket spoon found near the hearth; Dr. Sterling carries aconite in his medical bag, though the bag’s seal was undisturbed.',
      category: 'physical',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['bw_clue_decanter', 'bw_clue_ledger'],
      likelihoods: {
        suspect_julian: 0.56,
        suspect_clara: 0.36,
        suspect_sterling: 0.58,
        suspect_martha: 0.25,
      },
    },
    {
      id: 'bw_clue_monogram',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Charred Ledger & Cufflink',
      detail:
        'Half-burned trust audit pages in the study grate sit beside a snapped onyx cufflink bearing the initials J.V.',
      category: 'physical',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['bw_clue_watch'],
      likelihoods: {
        suspect_julian: 0.93,
        suspect_clara: 0.14,
        suspect_sterling: 0.16,
        suspect_martha: 0.12,
      },
    },
    {
      id: 'bw_clue_ledger',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Butler’s Drawing Room Testimony',
      detail:
        'The butler confirms Dr. Sterling remained asleep in the drawing room armchair from 11:05 PM until the scream.',
      category: 'testimony',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['bw_clue_mud'],
      likelihoods: {
        suspect_julian: 0.78,
        suspect_clara: 0.45,
        suspect_sterling: 0.12,
        suspect_martha: 0.38,
      },
    },
  ];

  const candidateQuestions: CandidateQuestion[] = [
    {
      id: 'bw_q_grate',
      prompt: 'Inspect the charred papers and ashes inside the study fireplace grate.',
      targetSuspectId: 'suspect_julian',
      positiveLikelihoods: { suspect_julian: 0.93, suspect_clara: 0.14, suspect_sterling: 0.16, suspect_martha: 0.12 },
      negativeLikelihoods: { suspect_julian: 0.20, suspect_clara: 0.55, suspect_sterling: 0.55, suspect_martha: 0.55 },
      asked: false,
    },
    {
      id: 'bw_q_butler',
      prompt: 'Ask the butler to verify whether Dr. Sterling ever left the downstairs drawing room.',
      targetSuspectId: 'suspect_sterling',
      positiveLikelihoods: { suspect_julian: 0.72, suspect_clara: 0.48, suspect_sterling: 0.12, suspect_martha: 0.42 },
      negativeLikelihoods: { suspect_julian: 0.22, suspect_clara: 0.25, suspect_sterling: 0.86, suspect_martha: 0.25 },
      asked: false,
    },
  ];

  return buildStageBundle({
    id: stageId,
    stageId,
    stageOrder: 1,
    title: 'Murder at Blackwood Manor',
    era: 'Murder Mystery · Easy · Estate 1928',
    difficulty: 'Novice',
    synopsis:
      'Situation: At 11:40 PM during a violent storm, Lord Alistair Blackwood was found dead in his locked mahogany study—poisoned by crushed monkshood dissolved into his evening sherry.',
    settingDetail: 'Locked Ground-Floor Study, Blackwood Manor, Yorkshire',
    culpritId: 'suspect_julian',
    solutionSummary:
      'Julian Vance faked his 11:15 PM departure at the gatehouse, slipped back into the study to poison Lord Blackwood’s sherry with monkshood, and burned the incriminating trust audit pages in the grate—losing his onyx cufflink in the rush.',
    bannerImageUrl: BLACKWOOD_BANNER,
    suspects,
    clues,
    candidateQuestions,
    openingSituationNote:
      'Murder Mystery — Stage I (Easy): Lord Alistair Blackwood has been poisoned inside his study at 11:40 PM. Three initial forensic and alibi clues sit on our desk.',
  });
}

export function createStage2Opera() {
  const stageId = 'murder_2_medium';
  const suspects: Suspect[] = [
    {
      id: 'suspect_marco',
      name: 'Marco Bellini',
      role: 'Principal Conductor',
      motive: 'Elena threatened to expose Marco’s plagiarism of an unpublished score to the conservatory board.',
      alibi: 'Claims he stayed on the orchestra pit podium reviewing cue sheets during intermission.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_vivienne',
      name: 'Vivienne Claire',
      role: 'Understudy Soprano',
      motive: 'Passed over for the royal gala opening while Elena held the lead role.',
      alibi: 'States she was warming up in the third-floor vocal rehearsal room.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_henri',
      name: 'Henri Moreau',
      role: 'Stage Manager',
      motive: 'Dismissed after quarreling with Elena over missing costume jewelry.',
      alibi: 'Insists he was operating the counterweight rigging above stage left.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_nadia',
      name: 'Nadia Volkova',
      role: 'Costume Designer',
      motive: 'Blackmailed by Elena over forged provenance receipts.',
      alibi: 'Remained in the wardrobe cellar steaming velvet gowns with two seamstresses.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
  ];

  const clues: ClueNode[] = [
    {
      id: 'op_clue_ribbon',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Silken Velvet Cord',
      detail:
        'Prima Donna Elena Moretti was strangled in Dressing Room 4 during the 15-minute Act II intermission using a stage-curtain tieback cord.',
      category: 'physical',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['op_clue_sheet', 'op_clue_vocal'],
      likelihoods: { suspect_marco: 0.55, suspect_vivienne: 0.62, suspect_henri: 0.72, suspect_nadia: 0.35 },
    },
    {
      id: 'op_clue_sheet',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Rosined Violin Bow Scrap',
      detail:
        'White rosin dust and a snapped horsehair thread clung to Elena’s collar—consistent with someone who had just come from the orchestra pit.',
      category: 'physical',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['op_clue_ribbon', 'op_clue_lock'],
      likelihoods: { suspect_marco: 0.80, suspect_vivienne: 0.32, suspect_henri: 0.30, suspect_nadia: 0.20 },
    },
    {
      id: 'op_clue_vocal',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Choir Master’s Corridor Note',
      detail:
        'A stagehand heard scales sung continuously from the third-floor rehearsal room throughout intermission, supporting Vivienne’s alibi.',
      category: 'testimony',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['op_clue_ribbon', 'op_clue_seamstress'],
      likelihoods: { suspect_marco: 0.64, suspect_vivienne: 0.38, suspect_henri: 0.52, suspect_nadia: 0.24 },
    },
    {
      id: 'op_clue_lock',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Conductor’s Stained Cuff & Score',
      detail:
        'In the pit washbasin, a torn page of the plagiarized score bears lipstick smudged from Elena’s vanity table and Marco’s baton wax.',
      category: 'cipher',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['op_clue_sheet'],
      likelihoods: { suspect_marco: 0.92, suspect_vivienne: 0.16, suspect_henri: 0.18, suspect_nadia: 0.12 },
    },
    {
      id: 'op_clue_seamstress',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Rigging Logbook Stamp',
      detail:
        'Two stagehands verify Henri never left the catwalk fly-gallery during the 15-minute curtain change.',
      category: 'alibi',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['op_clue_vocal'],
      likelihoods: { suspect_marco: 0.78, suspect_vivienne: 0.45, suspect_henri: 0.11, suspect_nadia: 0.25 },
    },
  ];

  const candidateQuestions: CandidateQuestion[] = [
    {
      id: 'op_q_washbasin',
      prompt: 'Search the orchestra pit washbasin and Marco Bellini’s conductor stand.',
      targetSuspectId: 'suspect_marco',
      positiveLikelihoods: { suspect_marco: 0.92, suspect_vivienne: 0.16, suspect_henri: 0.18, suspect_nadia: 0.12 },
      negativeLikelihoods: { suspect_marco: 0.18, suspect_vivienne: 0.58, suspect_henri: 0.58, suspect_nadia: 0.55 },
      asked: false,
    },
    {
      id: 'op_q_flygallery',
      prompt: 'Check the catwalk fly-gallery crew log for Henri Moreau’s intermission alibi.',
      targetSuspectId: 'suspect_henri',
      positiveLikelihoods: { suspect_marco: 0.76, suspect_vivienne: 0.48, suspect_henri: 0.11, suspect_nadia: 0.30 },
      negativeLikelihoods: { suspect_marco: 0.22, suspect_vivienne: 0.25, suspect_henri: 0.85, suspect_nadia: 0.25 },
      asked: false,
    },
  ];

  return buildStageBundle({
    id: stageId,
    stageId,
    stageOrder: 2,
    title: 'The Velvet Curtain Homicide',
    era: 'Murder Mystery · Medium · Opera Noir 1954',
    difficulty: 'Adept',
    synopsis:
      'Situation: Between Acts I and II at the Grand Opera House, star soprano Elena Moretti was strangled inside Dressing Room 4 during a 15-minute intermission.',
    settingDetail: 'Dressing Room 4 & Backstage Catwalk, Grand Opera House',
    culpritId: 'suspect_marco',
    solutionSummary:
      'Conductor Marco Bellini slipped up the pit stairs during intermission to retrieve his plagiarized manuscript from Elena’s vanity, strangled her with a spare velvet curtain cord, and left rosin and baton wax behind.',
    bannerImageUrl: ARCHIVE_BANNER,
    suspects,
    clues,
    candidateQuestions,
    openingSituationNote:
      'Murder Mystery — Stage II (Medium): Prima Donna Elena Moretti has been murdered backstage during a 15-minute intermission. Rosin dust on her collar and overlapping catwalk alibis complicate the trail.',
  });
}

export function createStage4Express() {
  const stageId = 'murder_3_hard';
  const suspects: Suspect[] = [
    {
      id: 'suspect_volkov',
      name: 'Countess Irina Volkov',
      role: 'Exiled Aristocrat',
      motive: 'The courier carried recovered Romanov bond certificates tied to her family estate.',
      alibi: 'Claims she took a sleeping draught at 11:30 PM inside Compartment 5.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_renard',
      name: 'Inspector Luc Renard',
      role: 'Private Security Escort',
      motive: 'Disgraced former detective paid to intercept diplomatic dispatches before Vienna.',
      alibi: 'States he patrolled the dining car corridor with the train conductor.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_keller',
      name: 'Dr. Otto Keller',
      role: 'Swiss Banker',
      motive: 'Faced ruin if the courier delivered audit ledgers exposing illegal alpine transfers.',
      alibi: 'Insists he played bridge in the smoking lounge until 1:00 AM.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_mei',
      name: 'Mei-Ling Zhou',
      role: 'Cipher Secretary',
      motive: 'Suspected the courier of framing her brother in an earlier Lisbon leak.',
      alibi: 'Remained in the telegraph car decoding diplomatic wires.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
  ];

  const clues: ClueNode[] = [
    {
      id: 'ex_clue_dagger',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Latched Compartment 7 & Stiletto',
      detail:
        'Courier Thomas Hale was stabbed once in the heart inside Compartment 7 while snow halted the train on the Alpine Viaduct. The door was locked from the corridor with a master passkey.',
      category: 'physical',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['ex_clue_telegram', 'ex_clue_ash'],
      likelihoods: { suspect_volkov: 0.45, suspect_renard: 0.76, suspect_keller: 0.58, suspect_mei: 0.42 },
    },
    {
      id: 'ex_clue_telegram',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Torn Bridge Scorecard',
      detail:
        'In the smoking lounge, the final bridge rubber ended at 12:10 AM—not 1:00 AM—leaving Dr. Otto Keller unaccounted for during the 25-minute viaduct halt.',
      category: 'alibi',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['ex_clue_dagger', 'ex_clue_cuff'],
      likelihoods: { suspect_volkov: 0.25, suspect_renard: 0.42, suspect_keller: 0.82, suspect_mei: 0.26 },
    },
    {
      id: 'ex_clue_ash',
      ownerId: 'guest',
      caseId: stageId,
      title: 'French Caporal Cigarette Ash',
      detail:
        'A crushed Caporal butt—Inspector Renard’s distinct brand—lay on the corridor carpet outside Compartment 7, yet the corridor steward recalls Renard borrowing a lighter at 12:15 AM.',
      category: 'location',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['ex_clue_dagger', 'ex_clue_ledger'],
      likelihoods: { suspect_volkov: 0.30, suspect_renard: 0.68, suspect_keller: 0.55, suspect_mei: 0.28 },
    },
    {
      id: 'ex_clue_cuff',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Missing Alpine Audit Folio',
      detail:
        'Only the red Zurich audit folio was removed from the victim’s steel briefcase; Romanov bonds and diplomatic wires were untouched, and Dr. Keller’s coat bore frozen viaduct frost on the hem.',
      category: 'physical',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['ex_clue_telegram'],
      likelihoods: { suspect_volkov: 0.14, suspect_renard: 0.24, suspect_keller: 0.94, suspect_mei: 0.15 },
    },
    {
      id: 'ex_clue_ledger',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Conductor’s Master Key Record',
      detail:
        'The sleeping-car conductor confirms his spare brass passkey vanished from his coat pocket while Dr. Keller brushed past him in the dining vestibule.',
      category: 'testimony',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['ex_clue_ash'],
      likelihoods: { suspect_volkov: 0.18, suspect_renard: 0.20, suspect_keller: 0.91, suspect_mei: 0.16 },
    },
  ];

  const candidateQuestions: CandidateQuestion[] = [
    {
      id: 'ex_q_briefcase',
      prompt: 'Inventory the victim’s steel briefcase to see which specific documents were stolen vs untouched.',
      targetSuspectId: 'suspect_keller',
      positiveLikelihoods: { suspect_volkov: 0.14, suspect_renard: 0.24, suspect_keller: 0.94, suspect_mei: 0.15 },
      negativeLikelihoods: { suspect_volkov: 0.60, suspect_renard: 0.55, suspect_keller: 0.18, suspect_mei: 0.55 },
      asked: false,
    },
    {
      id: 'ex_q_passkey',
      prompt: 'Question the sleeping-car conductor about when his spare master passkey disappeared.',
      targetSuspectId: 'suspect_keller',
      positiveLikelihoods: { suspect_volkov: 0.18, suspect_renard: 0.20, suspect_keller: 0.91, suspect_mei: 0.16 },
      negativeLikelihoods: { suspect_volkov: 0.55, suspect_renard: 0.58, suspect_keller: 0.20, suspect_mei: 0.55 },
      asked: false,
    },
  ];

  return buildStageBundle({
    id: stageId,
    stageId,
    stageOrder: 3,
    title: 'The Midnight Express, Car 7',
    era: 'Murder Mystery · Hard · Alpine Sleeper 1936',
    difficulty: 'Master',
    synopsis:
      'Situation: Snowbound on a high Alpine viaduct, diplomatic courier Thomas Hale was stabbed inside locked Compartment 7. With decoy cigarette ash and forged alibis across four suspects, precision deduction is required.',
    settingDetail: 'Compartment 7, Midnight Express Sleeper Car, Swiss Alps',
    culpritId: 'suspect_keller',
    solutionSummary:
      'Dr. Otto Keller lifted the conductor’s spare passkey in the dining vestibule, slipped along the icy exterior footboard to Compartment 7 to avoid the corridor steward, stabbed Thomas Hale, and stole only the Zurich audit folio.',
    bannerImageUrl: BLACKWOOD_BANNER,
    suspects,
    clues,
    candidateQuestions,
    openingSituationNote:
      'Murder Mystery — Stage III (Hard): Courier Thomas Hale lies dead inside locked Compartment 7 on a snowbound train. Decoy evidence points to Renard—verify the briefcase and passkey trail carefully.',
  });
}

/* ==========================================================================
 * TRACK 2: ANCIENT MYSTERY (EASY -> MEDIUM -> HARD)
 * ========================================================================== */

export function createAncient1Baghdad() {
  const stageId = 'ancient_1_easy';
  const suspects: Suspect[] = [
    {
      id: 'suspect_tariq',
      name: 'Tariq al-Kindi',
      role: 'Chief Translator',
      motive: 'Accused by the Caliph’s inspector of selling astronomical commentary drafts to rival courts.',
      alibi: 'Claims he stayed in the ink-mixing courtyard until the evening call to prayer.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_layla',
      name: 'Layla of Nishapur',
      role: 'Copperplate Engraver',
      motive: 'Her guild stipend was cut in half after her bronze astrolabe plate cracked.',
      alibi: 'States she was polishing star dials in the brass workshop with two apprentices.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_faris',
      name: 'Faris ibn Zayd',
      role: 'Vault Custodian',
      motive: 'Owed silver dinars to Tigris river merchants after a sunken spice barge.',
      alibi: 'Insists he handed the vault key to the night guard before dusk.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_selim',
      name: 'Selim the Byzantine',
      role: 'Visiting Scholar',
      motive: 'Sought the Greek-to-Arabic trigonometry scroll for his patron in Constantinople.',
      alibi: 'Remained in the guest caravanserai dining hall throughout the evening.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
  ];

  const clues: ClueNode[] = [
    {
      id: 'bg_clue_scroll',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Empty Cedar Scroll Tube',
      detail:
        'The Brass-Sealed Scroll of Al-Khwarizmi vanished from the House of Wisdom cedar chest without any broken hinges—someone opened it with the original wax ring.',
      category: 'physical',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['bg_clue_ink', 'bg_clue_gate'],
      likelihoods: { suspect_tariq: 0.72, suspect_layla: 0.45, suspect_faris: 0.78, suspect_selim: 0.35 },
    },
    {
      id: 'bg_clue_ink',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Lapis Pigment Thumbprint',
      detail:
        'Fresh lapis lazuli ink—used only by translators illuminating royal manuscripts—smudged the underside of the cedar vault latch.',
      category: 'physical',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['bg_clue_scroll', 'bg_clue_cipher'],
      likelihoods: { suspect_tariq: 0.86, suspect_layla: 0.25, suspect_faris: 0.28, suspect_selim: 0.40 },
    },
    {
      id: 'bg_clue_gate',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Night Guard’s Torch Report',
      detail:
        'The night guard confirms Faris turned in his custodian ring at dusk, yet saw a figure carrying a brass lantern hurry out of the ink courtyard.',
      category: 'testimony',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['bg_clue_scroll', 'bg_clue_apprentice'],
      likelihoods: { suspect_tariq: 0.75, suspect_layla: 0.35, suspect_faris: 0.16, suspect_selim: 0.42 },
    },
    {
      id: 'bg_clue_cipher',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Torn Margin Note in Tariq’s Hand',
      detail:
        'A discarded calculation strip wedged inside the vault door bears Tariq’s unmistakable diacritical marks and the price agreed with a Damascus courier.',
      category: 'cipher',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['bg_clue_ink'],
      likelihoods: { suspect_tariq: 0.94, suspect_layla: 0.14, suspect_faris: 0.15, suspect_selim: 0.18 },
    },
    {
      id: 'bg_clue_apprentice',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Caravanserai Host Confirmation',
      detail:
        'The guest hall host verifies Selim debated astronomy with four jurists all evening without stepping outside.',
      category: 'alibi',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['bg_clue_gate'],
      likelihoods: { suspect_tariq: 0.76, suspect_layla: 0.42, suspect_faris: 0.30, suspect_selim: 0.10 },
    },
  ];

  const candidateQuestions: CandidateQuestion[] = [
    {
      id: 'bg_q_door',
      prompt: 'Inspect the cedar vault door hinges and threshold for dropped translator notes.',
      targetSuspectId: 'suspect_tariq',
      positiveLikelihoods: { suspect_tariq: 0.94, suspect_layla: 0.14, suspect_faris: 0.15, suspect_selim: 0.18 },
      negativeLikelihoods: { suspect_tariq: 0.20, suspect_layla: 0.55, suspect_faris: 0.55, suspect_selim: 0.55 },
      asked: false,
    },
    {
      id: 'bg_q_host',
      prompt: 'Ask the caravanserai host to corroborate Selim’s presence in the dining hall.',
      targetSuspectId: 'suspect_selim',
      positiveLikelihoods: { suspect_tariq: 0.72, suspect_layla: 0.45, suspect_faris: 0.35, suspect_selim: 0.10 },
      negativeLikelihoods: { suspect_tariq: 0.25, suspect_layla: 0.25, suspect_faris: 0.25, suspect_selim: 0.85 },
      asked: false,
    },
  ];

  return buildStageBundle({
    id: stageId,
    stageId,
    stageOrder: 1,
    title: 'The Vanished Brass Scroll',
    era: 'Ancient Mystery · Easy · Baghdad 830 CE',
    difficulty: 'Novice',
    synopsis:
      'Situation: Inside the Abbasid House of Wisdom in 830 CE, a priceless brass-sealed mathematical scroll vanished from its locked cedar chest without force.',
    settingDetail: 'Vaulted Manuscript Wing, House of Wisdom, Baghdad',
    culpritId: 'suspect_tariq',
    solutionSummary:
      'Chief Translator Tariq al-Kindi pressed a duplicate wax impression earlier that day, opened the cedar vault with lapis-stained fingers, and slipped the scroll to a Damascus courier.',
    bannerImageUrl: ARCHIVE_BANNER,
    suspects,
    clues,
    candidateQuestions,
    openingSituationNote:
      'Ancient Mystery — Stage I (Easy): A royal mathematical scroll has vanished from the House of Wisdom vault in Baghdad. Trace the lapis pigment and guard testimony.',
  });
}

export function createStage3AlexandriaMurder() {
  const stageId = 'ancient_2_medium';
  const suspects: Suspect[] = [
    {
      id: 'suspect_theron',
      name: 'Theron of Rhodes',
      role: 'Master Instrument Maker',
      motive: 'His rival astrolabe design was rejected; the Keeper threatened to expose his forged star tables.',
      alibi: 'Claims he remained in the bronze foundry tempering gear rings until dawn.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_lysandria',
      name: 'Lysandra the Keeper',
      role: 'Night Archivist of Scrolls',
      motive: 'Owed substantial silver debts to maritime merchants from Delos.',
      alibi: 'Insists she cataloged celestial ephemerides in the eastern colonnade.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_cassian',
      name: 'Cassian of Antioch',
      role: 'Visiting Geometer',
      motive: 'Sought the star-projection plates to publish the Alexandrian meridian under his own patron.',
      alibi: 'States he departed the harbor gate before the third night watch.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_miriam',
      name: 'Miriam of Cyrene',
      role: 'Chief Sidereal Observer',
      motive: 'Feared the brass tables contained errors that would discredit her eclipse calculations.',
      alibi: 'Reportedly retired to her quarters when coastal fog obscured the horizon.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
  ];

  const clues: ClueNode[] = [
    {
      id: 'ax_clue_caliper',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Fatal Brass Caliper Wound',
      detail:
        'The Observatory Watchman was struck down beside the shattered astrolabe plinth with a heavy bronze caliper blade, and the gilded star plate is missing.',
      category: 'physical',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['ax_clue_wax', 'ax_clue_foundry'],
      likelihoods: { suspect_theron: 0.78, suspect_lysandria: 0.42, suspect_cassian: 0.55, suspect_miriam: 0.35 },
    },
    {
      id: 'ax_clue_wax',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Saffron & Beeswax Seal Drops',
      detail:
        'Drops of golden saffron sealing wax—used exclusively by the Royal Scroll Room—were found beside the body.',
      category: 'location',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['ax_clue_caliper', 'ax_clue_harbor'],
      likelihoods: { suspect_theron: 0.30, suspect_lysandria: 0.76, suspect_cassian: 0.40, suspect_miriam: 0.62 },
    },
    {
      id: 'ax_clue_foundry',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Cold Foundry Ledger',
      detail:
        'Night patrol logs confirm the bronze foundry hearth was cold before midnight, contradicting Theron’s claim of tempering metal until dawn.',
      category: 'alibi',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['ax_clue_caliper', 'ax_clue_vernier'],
      likelihoods: { suspect_theron: 0.84, suspect_lysandria: 0.28, suspect_cassian: 0.32, suspect_miriam: 0.25 },
    },
    {
      id: 'ax_clue_harbor',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Unstamped Harbor Cargo',
      detail:
        'Harbor records reveal Cassian boarded with only parchment rolls—no heavy brass plates.',
      category: 'testimony',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['ax_clue_wax'],
      likelihoods: { suspect_theron: 0.65, suspect_lysandria: 0.50, suspect_cassian: 0.14, suspect_miriam: 0.48 },
    },
    {
      id: 'ax_clue_vernier',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Rhodian Vernier Scratches',
      detail:
        'Oblique lamplight reveals freshly scratched notches on the plinth matching Theron’s Rhodian vernier caliper.',
      category: 'cipher',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['ax_clue_foundry'],
      likelihoods: { suspect_theron: 0.92, suspect_lysandria: 0.18, suspect_cassian: 0.20, suspect_miriam: 0.22 },
    },
  ];

  const candidateQuestions: CandidateQuestion[] = [
    {
      id: 'ax_q_plinth',
      prompt: 'Examine the stone plinth notches under oblique lamplight.',
      targetSuspectId: 'suspect_theron',
      positiveLikelihoods: { suspect_theron: 0.92, suspect_lysandria: 0.18, suspect_cassian: 0.20, suspect_miriam: 0.22 },
      negativeLikelihoods: { suspect_theron: 0.18, suspect_lysandria: 0.55, suspect_cassian: 0.55, suspect_miriam: 0.55 },
      asked: false,
    },
    {
      id: 'ax_q_harbor',
      prompt: 'Inspect the harbor master cargo manifest for Cassian’s midnight vessel.',
      targetSuspectId: 'suspect_cassian',
      positiveLikelihoods: { suspect_theron: 0.60, suspect_lysandria: 0.52, suspect_cassian: 0.14, suspect_miriam: 0.50 },
      negativeLikelihoods: { suspect_theron: 0.22, suspect_lysandria: 0.25, suspect_cassian: 0.85, suspect_miriam: 0.25 },
      asked: false,
    },
  ];

  return buildStageBundle({
    id: stageId,
    stageId,
    stageOrder: 2,
    title: 'Blood on the Alexandria Astrolabe',
    era: 'Ancient Mystery · Medium · Alexandria 240 BCE',
    difficulty: 'Adept',
    synopsis:
      'Situation: The night watchman of the Upper Observatory in Alexandria was found slain beside an empty astrolabe pedestal. Murder and scholarly theft intertwine beneath the stars.',
    settingDetail: 'Upper Observatory Dome, Royal Precinct of Alexandria',
    culpritId: 'suspect_theron',
    solutionSummary:
      'Theron of Rhodes extinguished his foundry early, struck down the night watchman with his own brass caliper when caught dismantling the astrolabe, and planted Lysandra’s discarded saffron wax to mislead investigators.',
    bannerImageUrl: ALEXANDRIA_BANNER,
    suspects,
    clues,
    candidateQuestions,
    openingSituationNote:
      'Ancient Mystery — Stage II (Medium): A watchman lies slain beside the looted astrolabe dome in Alexandria. Separate genuine forensic marks from planted saffron wax.',
  });
}

export function createAncient3SilkRoad() {
  const stageId = 'ancient_3_hard';
  const suspects: Suspect[] = [
    {
      id: 'suspect_wei',
      name: 'Envoy Wei Shen',
      role: 'Han Caravan Magistrate',
      motive: 'Discovered the murdered Parthian envoy carried proof Wei had bribed border scouts.',
      alibi: 'Claims he sealed his tent at midnight after checking the jade tribute chests.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_azadeh',
      name: 'Azadeh of Merv',
      role: 'Herbalist & Physician',
      motive: 'Her brother was imprisoned by the Parthian court two winters ago.',
      alibi: 'States she tended fevered camel drivers in the eastern stable yard.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_darius',
      name: 'Darius the Sogdian',
      role: 'Caravan Master',
      motive: 'Paid double silver if the diplomatic treaty never reached Chang’an.',
      alibi: 'Insists he patrolled the outer oasis wall with two lantern bearers.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_livia',
      name: 'Livia Sabina',
      role: 'Roman Glass Merchant',
      motive: 'Sought the silk-dye trade monopoly promised in the envoy’s sealed pouch.',
      alibi: 'Remained inside the women’s courtyard caravan tent during the sandstorm.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
  ];

  const clues: ClueNode[] = [
    {
      id: 'sr_clue_cup',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Lacquer Tea Bowl & Jade Seal',
      detail:
        'The Parthian envoy was poisoned in the caravanserai bath pavilion; a decoy Persian herb sachet was left on the rim while his treaty seal vanished.',
      category: 'physical',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['sr_clue_sand', 'sr_clue_lantern'],
      likelihoods: { suspect_wei: 0.62, suspect_azadeh: 0.72, suspect_darius: 0.45, suspect_livia: 0.38 },
    },
    {
      id: 'sr_clue_sand',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Cinnabar Wax in Boot Treads',
      detail:
        'Crimson cinnabar seal wax—used exclusively on Han magistrate dispatches—was pressed into wet mud beside the bath pavilion door.',
      category: 'location',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['sr_clue_cup', 'sr_clue_treaty'],
      likelihoods: { suspect_wei: 0.85, suspect_azadeh: 0.22, suspect_darius: 0.30, suspect_livia: 0.25 },
    },
    {
      id: 'sr_clue_lantern',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Stable Yard Witness Note',
      detail:
        'Three caravan drivers confirm Azadeh never left the sick stable until the alarm sounded—pointing toward the herb sachet being planted.',
      category: 'testimony',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['sr_clue_cup', 'sr_clue_ledger'],
      likelihoods: { suspect_wei: 0.74, suspect_azadeh: 0.16, suspect_darius: 0.55, suspect_livia: 0.40 },
    },
    {
      id: 'sr_clue_treaty',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Scorched Bribe Tally Inside Tribute Chest',
      detail:
        'Beneath Envoy Wei Shen’s jade tribute tray lies half-burned silver bribe silk matching the envoy’s missing dispatch.',
      category: 'cipher',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['sr_clue_sand'],
      likelihoods: { suspect_wei: 0.94, suspect_azadeh: 0.12, suspect_darius: 0.18, suspect_livia: 0.14 },
    },
    {
      id: 'sr_clue_ledger',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Oasis Wall Watch Tally',
      detail:
        'Gate sentries logged Darius’s lantern patrol passing the north tower every quarter hour throughout the night.',
      category: 'alibi',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['sr_clue_lantern'],
      likelihoods: { suspect_wei: 0.78, suspect_azadeh: 0.24, suspect_darius: 0.12, suspect_livia: 0.36 },
    },
  ];

  const candidateQuestions: CandidateQuestion[] = [
    {
      id: 'sr_q_chest',
      prompt: 'Inspect the false bottom of Envoy Wei Shen’s jade tribute chest.',
      targetSuspectId: 'suspect_wei',
      positiveLikelihoods: { suspect_wei: 0.94, suspect_azadeh: 0.12, suspect_darius: 0.18, suspect_livia: 0.14 },
      negativeLikelihoods: { suspect_wei: 0.18, suspect_azadeh: 0.55, suspect_darius: 0.55, suspect_livia: 0.55 },
      asked: false,
    },
    {
      id: 'sr_q_sentries',
      prompt: 'Check the north tower sentry tally for Darius the Sogdian’s patrol.',
      targetSuspectId: 'suspect_darius',
      positiveLikelihoods: { suspect_wei: 0.76, suspect_azadeh: 0.25, suspect_darius: 0.12, suspect_livia: 0.40 },
      negativeLikelihoods: { suspect_wei: 0.22, suspect_azadeh: 0.25, suspect_darius: 0.85, suspect_livia: 0.25 },
      asked: false,
    },
  ];

  return buildStageBundle({
    id: stageId,
    stageId,
    stageOrder: 3,
    title: 'Poison in the Silk Road Caravanserai',
    era: 'Ancient Mystery · Hard · Dunhuang 120 CE',
    difficulty: 'Master',
    synopsis:
      'Situation: During a desert sandstorm at a Silk Road caravanserai, a Parthian envoy was poisoned and his treaty pouch stolen—with a planted herb sachet casting false blame on the healer.',
    settingDetail: 'Oasis Caravanserai Bath Pavilion, Dunhuang Frontier',
    culpritId: 'suspect_wei',
    solutionSummary:
      'Han Magistrate Wei Shen poisoned the envoy’s tea bowl to destroy bribery proof, planted Azadeh’s herb sachet as a decoy, and hid the burnt silk tally inside his jade tribute chest.',
    bannerImageUrl: ALEXANDRIA_BANNER,
    suspects,
    clues,
    candidateQuestions,
    openingSituationNote:
      'Ancient Mystery — Stage III (Hard): An imperial envoy lies poisoned inside a sandstorm-bound caravanserai. Unravel the planted herb decoy and cinnabar wax trail.',
  });
}

/* ==========================================================================
 * TRACK 3: HEIST & CIPHER MYSTERY (EASY -> MEDIUM -> HARD)
 * ========================================================================== */

export function createHeist1JadeSeal() {
  const stageId = 'heist_1_easy';
  const suspects: Suspect[] = [
    {
      id: 'suspect_lin',
      name: 'Marcus Lin',
      role: 'Gallery Restorer',
      motive: 'Deeply indebted to concession creditors; crafted museum-grade jade replicas.',
      alibi: 'Claims he left the East Wing restoration bench at 9:30 PM.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_evelyn',
      name: 'Evelyn Shaw',
      role: 'Visiting Collector',
      motive: 'Twice outbid by the museum when acquiring Ming Dynasty artifacts.',
      alibi: 'States she attended the curator reception in the rotunda until 10:15 PM.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_chen',
      name: 'Captain Chen Wu',
      role: 'Night Security Chief',
      motive: 'Reprimanded last month for missing keycard logs.',
      alibi: 'Insists he stayed at the front lobby desk monitoring alarm bells.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_arthur',
      name: 'Arthur Pendelton',
      role: 'Insurance Appraiser',
      motive: 'Stood to collect a finder fee if the original seal resurfaced privately.',
      alibi: 'Remained in the archive vault cataloging silver coins.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
  ];

  const clues: ClueNode[] = [
    {
      id: 'hc_clue_resin',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Warm Resin Replica in Case 4',
      detail:
        'The Imperial Jade Seal was swapped for a painted soapstone replica without tripping the pressure plate—requiring exact weight calibration (412 grams).',
      category: 'physical',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['hc_clue_badge', 'hc_clue_reception'],
      likelihoods: { suspect_lin: 0.84, suspect_evelyn: 0.40, suspect_chen: 0.45, suspect_arthur: 0.55 },
    },
    {
      id: 'hc_clue_badge',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Uncured Varnish on Skylight Latch',
      detail:
        'Smears of fast-drying amber varnish used in the restoration studio match paint flecks on the gallery skylight handle.',
      category: 'location',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['hc_clue_resin', 'hc_clue_lathe'],
      likelihoods: { suspect_lin: 0.86, suspect_evelyn: 0.22, suspect_chen: 0.25, suspect_arthur: 0.28 },
    },
    {
      id: 'hc_clue_reception',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Rotunda Guest Book Sign-In',
      detail:
        'Three trustees photographed Evelyn Shaw in the main rotunda during the exact 10:00 PM gallery chime.',
      category: 'alibi',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['hc_clue_resin', 'hc_clue_vault'],
      likelihoods: { suspect_lin: 0.70, suspect_evelyn: 0.14, suspect_chen: 0.42, suspect_arthur: 0.45 },
    },
    {
      id: 'hc_clue_lathe',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Hidden Soapstone Shavings & Scale',
      detail:
        'Inside Marcus Lin’s locked studio drawer sits a brass balance set to 412.0 grams and fresh green soapstone dust.',
      category: 'physical',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['hc_clue_badge'],
      likelihoods: { suspect_lin: 0.95, suspect_evelyn: 0.12, suspect_chen: 0.15, suspect_arthur: 0.16 },
    },
    {
      id: 'hc_clue_vault',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Vault Time-Stamp Log',
      detail:
        'The sub-basement coin vault requires two clerks to unlock; Arthur Pendelton never left the vault until 10:30 PM.',
      category: 'testimony',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['hc_clue_reception'],
      likelihoods: { suspect_lin: 0.78, suspect_evelyn: 0.28, suspect_chen: 0.35, suspect_arthur: 0.11 },
    },
  ];

  const candidateQuestions: CandidateQuestion[] = [
    {
      id: 'hc_q_studio',
      prompt: 'Inspect Marcus Lin’s locked restoration bench drawer and brass balance.',
      targetSuspectId: 'suspect_lin',
      positiveLikelihoods: { suspect_lin: 0.95, suspect_evelyn: 0.12, suspect_chen: 0.15, suspect_arthur: 0.16 },
      negativeLikelihoods: { suspect_lin: 0.18, suspect_evelyn: 0.55, suspect_chen: 0.55, suspect_arthur: 0.55 },
      asked: false,
    },
    {
      id: 'hc_q_vault',
      prompt: 'Check the sub-basement vault log for Arthur Pendelton’s exit timestamp.',
      targetSuspectId: 'suspect_arthur',
      positiveLikelihoods: { suspect_lin: 0.74, suspect_evelyn: 0.25, suspect_chen: 0.35, suspect_arthur: 0.11 },
      negativeLikelihoods: { suspect_lin: 0.25, suspect_evelyn: 0.25, suspect_chen: 0.25, suspect_arthur: 0.85 },
      asked: false,
    },
  ];

  return buildStageBundle({
    id: stageId,
    stageId,
    stageOrder: 1,
    title: 'The Missing Jade Seal',
    era: 'Heist & Cipher · Easy · Shanghai 1922',
    difficulty: 'Novice',
    synopsis:
      'Situation: During a museum gala in 1922 Shanghai, the priceless Ming Jade Seal was swapped out of a pressure-sensitive glass case for a 412-gram replica without triggering an alarm.',
    settingDetail: 'East Wing Exhibition Hall, Shanghai Museum',
    culpritId: 'suspect_lin',
    solutionSummary:
      'Gallery restorer Marcus Lin carved a 412-gram soapstone duplicate in his studio, climbed through the skylight while varnish was still wet on his cuffs, and performed a silent weight-matched swap.',
    bannerImageUrl: ARCHIVE_BANNER,
    suspects,
    clues,
    candidateQuestions,
    openingSituationNote:
      'Heist & Cipher — Stage I (Easy): The Ming Jade Seal was swapped for an exact 412-gram replica without tripping the pressure alarm. Examine the varnish flecks and weight evidence.',
  });
}

export function createHeist2ClockmakerVault() {
  const stageId = 'heist_2_medium';
  const suspects: Suspect[] = [
    {
      id: 'suspect_breguet',
      name: 'Henriette Breguet',
      role: 'Master Horologist',
      motive: 'Designed the bank’s time-lock mechanism and was denied co-patent royalties.',
      alibi: 'Claims she stayed in her workshop calibrating pocket chronometers.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_laurent',
      name: 'Laurent Mercier',
      role: 'Bank Vice-Director',
      motive: 'Lost client deposits in silver futures and needed the vault’s bearer sapphires.',
      alibi: 'States he attended a late dinner across Lake Geneva.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_victor',
      name: 'Viktor Novak',
      role: 'Night Boilerman',
      motive: 'Recently threatened with dismissal over missing coal vouchers.',
      alibi: 'Insists he shoveled coal in the basement furnace room until 2:00 AM.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_claire',
      name: 'Claire De Vries',
      role: 'Jewel Courier',
      motive: 'Held duplicate insurance paperwork for the stolen sapphire cassette.',
      alibi: 'Remained in the hotel lobby across the square.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
  ];

  const clues: ClueNode[] = [
    {
      id: 'gv_clue_clock',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Magnetized Time-Lock Escapement',
      detail:
        'The Geneva vault’s triple-chronometer lock opened 45 minutes early because a hidden lodestone sleeve slowed its balance wheel—knowledge only the lock’s maker possessed.',
      category: 'cipher',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['gv_clue_ferry', 'gv_clue_oil'],
      likelihoods: { suspect_breguet: 0.85, suspect_laurent: 0.42, suspect_victor: 0.30, suspect_claire: 0.28 },
    },
    {
      id: 'gv_clue_ferry',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Lake Geneva Restaurant Receipt',
      detail:
        'Three banking partners signed Laurent Mercier’s dinner toast ledger at the lakeside hotel at the exact hour the vault opened.',
      category: 'alibi',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['gv_clue_clock', 'gv_clue_glove'],
      likelihoods: { suspect_breguet: 0.72, suspect_laurent: 0.14, suspect_victor: 0.50, suspect_claire: 0.45 },
    },
    {
      id: 'gv_clue_oil',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Whale-Oil Gear Lubricant Drop',
      detail:
        'Rare refined watchmaker’s oil dripped onto the steel vault threshold—identical to the vial used exclusively on Swiss precision escapements.',
      category: 'physical',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['gv_clue_clock', 'gv_clue_boiler'],
      likelihoods: { suspect_breguet: 0.86, suspect_laurent: 0.22, suspect_victor: 0.24, suspect_claire: 0.20 },
    },
    {
      id: 'gv_clue_glove',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Lodestone Sleeve in Clock Bench',
      detail:
        'A custom brass lodestone collar matching the vault escapement curvature was found inside Henriette Breguet’s coat pocket alongside a sapphire velvet ribbon.',
      category: 'physical',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['gv_clue_ferry'],
      likelihoods: { suspect_breguet: 0.94, suspect_laurent: 0.12, suspect_victor: 0.15, suspect_claire: 0.16 },
    },
    {
      id: 'gv_clue_boiler',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Furnace Gauge Pressure Strip',
      detail:
        'Automatic steam-pressure needles prove Viktor stoked the basement boiler continuously every ten minutes until 2:00 AM.',
      category: 'testimony',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['gv_clue_oil'],
      likelihoods: { suspect_breguet: 0.78, suspect_laurent: 0.20, suspect_victor: 0.11, suspect_claire: 0.32 },
    },
  ];

  const candidateQuestions: CandidateQuestion[] = [
    {
      id: 'gv_q_workshop',
      prompt: 'Search Henriette Breguet’s horology bench and coat pockets for magnetic sleeves.',
      targetSuspectId: 'suspect_breguet',
      positiveLikelihoods: { suspect_breguet: 0.94, suspect_laurent: 0.12, suspect_victor: 0.15, suspect_claire: 0.16 },
      negativeLikelihoods: { suspect_breguet: 0.18, suspect_laurent: 0.55, suspect_victor: 0.55, suspect_claire: 0.55 },
      asked: false,
    },
    {
      id: 'gv_q_steam',
      prompt: 'Inspect the basement boiler steam-pressure chart to verify Viktor Novak’s stoking schedule.',
      targetSuspectId: 'suspect_victor',
      positiveLikelihoods: { suspect_breguet: 0.76, suspect_laurent: 0.22, suspect_victor: 0.11, suspect_claire: 0.35 },
      negativeLikelihoods: { suspect_breguet: 0.25, suspect_laurent: 0.25, suspect_victor: 0.86, suspect_claire: 0.25 },
      asked: false,
    },
  ];

  return buildStageBundle({
    id: stageId,
    stageId,
    stageOrder: 2,
    title: "The Clockmaker's Vault",
    era: 'Heist & Cipher · Medium · Geneva 1899',
    difficulty: 'Adept',
    synopsis:
      'Situation: In 1899 Geneva, a bearer sapphire cassette vanished from an impenetrable time-lock bank vault 45 minutes before the scheduled unlock—without a single scratch on the steel door.',
    settingDetail: 'Sub-Basement Time-Lock Chamber, Banque Horlogère, Geneva',
    culpritId: 'suspect_breguet',
    solutionSummary:
      'Master Horologist Henriette Breguet fitted a custom lodestone sleeve onto her own time-lock balance wheel during routine inspection, causing the door to release 45 minutes early while she slipped inside unnoticed.',
    bannerImageUrl: ARCHIVE_BANNER,
    suspects,
    clues,
    candidateQuestions,
    openingSituationNote:
      "Heist & Cipher — Stage II (Medium): A sapphire cassette was stolen from Geneva's triple-chronometer vault 45 minutes early. Examine the watchmaker oil and magnetized escapement.",
  });
}

export function createHeist3CipheredTelegraph() {
  const stageId = 'heist_3_hard';
  const suspects: Suspect[] = [
    {
      id: 'suspect_ward',
      name: 'Edward Ward',
      role: 'Chief Telegraphist',
      motive: 'Sold naval convoy timings to foreign syndicates to cover London debts.',
      alibi: 'Claims he logged off the Morse key at 11:45 PM before the cable relay failed.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_sylvia',
      name: 'Sylvia Hale',
      role: 'Cipher Clerk',
      motive: 'Denied promotion after cracking the North Atlantic merchant code.',
      alibi: 'States she walked home along the embankment at 11:30 PM.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_gordon',
      name: 'Captain Gordon Vance',
      role: 'Port Harbor Liaison',
      motive: 'Owned shares in a rival shipping consortium.',
      alibi: 'Insists he stayed aboard the customs cutter anchored off Pier 3.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
    {
      id: 'suspect_felix',
      name: 'Felix Moreau',
      role: 'Cable Maintenance Engineer',
      motive: 'Suspected of tampering with relay batteries after a wage dispute.',
      alibi: 'Was repairing storm-damaged insulators in the junction cellar.',
      priorProbability: 0.25,
      posteriorProbability: 0.25,
      deltaFromPrior: 0,
    },
  ];

  const clues: ClueNode[] = [
    {
      id: 'ct_clue_tape',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Phantom Midnight Morse Tape',
      detail:
        'An encrypted convoy route was transmitted at 12:04 AM while the main register showed offline—yet the automatic ink-wheel recorded a distinct left-handed dot cadence.',
      category: 'cipher',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['ct_clue_gloves', 'ct_clue_ferry'],
      likelihoods: { suspect_ward: 0.80, suspect_sylvia: 0.62, suspect_gordon: 0.30, suspect_felix: 0.45 },
    },
    {
      id: 'ct_clue_gloves',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Sabotaged Junction Fuse',
      detail:
        'Someone spliced a bypass wire around the office clock-relay—planted with Felix’s copper pliers, though Felix’s toolbelt was locked inside the cellar fuse-box.',
      category: 'physical',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['ct_clue_tape', 'ct_clue_cipherbook'],
      likelihoods: { suspect_ward: 0.72, suspect_sylvia: 0.48, suspect_gordon: 0.25, suspect_felix: 0.64 },
    },
    {
      id: 'ct_clue_ferry',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Embankment Tram Ticket',
      detail:
        'A punched 11:36 PM tram stub and conductor signature confirm Sylvia Hale boarded miles away before midnight.',
      category: 'alibi',
      source: 'initial',
      discovered: true,
      connectedNodeIds: ['ct_clue_tape', 'ct_clue_cellar'],
      likelihoods: { suspect_ward: 0.76, suspect_sylvia: 0.14, suspect_gordon: 0.45, suspect_felix: 0.55 },
    },
    {
      id: 'ct_clue_cipherbook',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Left-Handed Telegraphist Callus & One-Time Pad',
      detail:
        'Hidden inside Edward Ward’s tobacco tin is the stolen Admiralty cipher sheet, and his left index finger matches the ink-wheel’s signature cadence.',
      category: 'cipher',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['ct_clue_gloves'],
      likelihoods: { suspect_ward: 0.95, suspect_sylvia: 0.12, suspect_gordon: 0.15, suspect_felix: 0.14 },
    },
    {
      id: 'ct_clue_cellar',
      ownerId: 'guest',
      caseId: stageId,
      title: 'Customs Cutter Signal Log',
      detail:
        'Pier 3 signal lamps logged Captain Gordon Vance on deck throughout the storm squall.',
      category: 'testimony',
      source: 'discovered',
      discovered: false,
      connectedNodeIds: ['ct_clue_ferry'],
      likelihoods: { suspect_ward: 0.78, suspect_sylvia: 0.20, suspect_gordon: 0.10, suspect_felix: 0.38 },
    },
  ];

  const candidateQuestions: CandidateQuestion[] = [
    {
      id: 'ct_q_tin',
      prompt: 'Inspect Edward Ward’s telegraph desk, tobacco tin, and Morse keying cadence records.',
      targetSuspectId: 'suspect_ward',
      positiveLikelihoods: { suspect_ward: 0.95, suspect_sylvia: 0.12, suspect_gordon: 0.15, suspect_felix: 0.14 },
      negativeLikelihoods: { suspect_ward: 0.18, suspect_sylvia: 0.55, suspect_gordon: 0.55, suspect_felix: 0.55 },
      asked: false,
    },
    {
      id: 'ct_q_pier',
      prompt: 'Verify Pier 3 customs cutter signal logs for Captain Gordon Vance.',
      targetSuspectId: 'suspect_gordon',
      positiveLikelihoods: { suspect_ward: 0.76, suspect_sylvia: 0.22, suspect_gordon: 0.10, suspect_felix: 0.40 },
      negativeLikelihoods: { suspect_ward: 0.25, suspect_sylvia: 0.25, suspect_gordon: 0.85, suspect_felix: 0.25 },
      asked: false,
    },
  ];

  return buildStageBundle({
    id: stageId,
    stageId,
    stageOrder: 3,
    title: 'The Ciphered Telegraph',
    era: 'Heist & Cipher · Hard · Maritime Exchange 1912',
    difficulty: 'Master',
    synopsis:
      'Situation: Inside the 1912 London Maritime Exchange, confidential naval convoy routes were transmitted over a supposedly offline telegraph line at 12:04 AM using stolen cipher pads.',
    settingDetail: 'Signal & Cipher Room, Maritime Exchange, London',
    culpritId: 'suspect_ward',
    solutionSummary:
      'Chief Telegraphist Edward Ward bypassed the office clock-relay using Felix’s misplaced pliers as a decoy, transmitted the convoy codes left-handedly at 12:04 AM, and hid the stolen one-time pad inside his tobacco tin.',
    bannerImageUrl: ARCHIVE_BANNER,
    suspects,
    clues,
    candidateQuestions,
    openingSituationNote:
      'Heist & Cipher — Stage III (Hard): Secret convoy routes were leaked over an offline telegraph line at 12:04 AM. Decode the Morse cadence and planted junction decoy.',
  });
}

export const CAMPAIGN_STAGES: CampaignStage[] = [
  // Track 1: Murder Mystery
  {
    stageId: 'murder_1_easy',
    categoryId: 'murder',
    categoryLabel: 'Murder Mystery',
    stageOrder: 1,
    stageLabel: 'Stage I',
    difficultyTier: 'Easy',
    difficulty: 'Novice',
    genre: 'Murder Mystery',
    locationName: 'Blackwood Manor',
    coordinates: { x: 115, y: 145 },
    summary: 'Poisoned sherry behind a latched mahogany study door during a midnight storm.',
    createBundle: createStage1Blackwood,
  },
  {
    stageId: 'murder_2_medium',
    categoryId: 'murder',
    categoryLabel: 'Murder Mystery',
    stageOrder: 2,
    stageLabel: 'Stage II',
    difficultyTier: 'Medium',
    difficulty: 'Adept',
    genre: 'Murder Mystery',
    locationName: 'Grand Opera House',
    coordinates: { x: 350, y: 92 },
    summary: 'Prima donna strangled in Dressing Room 4 during a 15-minute intermission.',
    createBundle: createStage2Opera,
  },
  {
    stageId: 'murder_3_hard',
    categoryId: 'murder',
    categoryLabel: 'Murder Mystery',
    stageOrder: 3,
    stageLabel: 'Stage III',
    difficultyTier: 'Hard',
    difficulty: 'Master',
    genre: 'Murder Mystery',
    locationName: 'Alpine Express Car 7',
    coordinates: { x: 585, y: 145 },
    summary: 'Snowbound sleeper-car stabbing with decoy ash and missing Zurich ledgers.',
    createBundle: createStage4Express,
  },

  // Track 2: Ancient Mystery
  {
    stageId: 'ancient_1_easy',
    categoryId: 'ancient',
    categoryLabel: 'Ancient Mystery',
    stageOrder: 1,
    stageLabel: 'Stage I',
    difficultyTier: 'Easy',
    difficulty: 'Novice',
    genre: 'Ancient Mystery',
    locationName: 'Baghdad House of Wisdom',
    coordinates: { x: 115, y: 145 },
    summary: 'A brass-sealed mathematical scroll stolen from a cedar vault with lapis ink traces.',
    createBundle: createAncient1Baghdad,
  },
  {
    stageId: 'ancient_2_medium',
    categoryId: 'ancient',
    categoryLabel: 'Ancient Mystery',
    stageOrder: 2,
    stageLabel: 'Stage II',
    difficultyTier: 'Medium',
    difficulty: 'Adept',
    genre: 'Ancient Mystery',
    locationName: 'Alexandria Observatory',
    coordinates: { x: 350, y: 92 },
    summary: 'Night watchman slain beneath the gilded astrolabe dome with planted saffron wax.',
    createBundle: createStage3AlexandriaMurder,
  },
  {
    stageId: 'ancient_3_hard',
    categoryId: 'ancient',
    categoryLabel: 'Ancient Mystery',
    stageOrder: 3,
    stageLabel: 'Stage III',
    difficultyTier: 'Hard',
    difficulty: 'Master',
    genre: 'Ancient Mystery',
    locationName: 'Dunhuang Caravanserai',
    coordinates: { x: 585, y: 145 },
    summary: 'Imperial envoy poisoned during a Silk Road sandstorm amid cinnabar wax clues.',
    createBundle: createAncient3SilkRoad,
  },

  // Track 3: Heist & Cipher
  {
    stageId: 'heist_1_easy',
    categoryId: 'heist',
    categoryLabel: 'Heist & Cipher',
    stageOrder: 1,
    stageLabel: 'Stage I',
    difficultyTier: 'Easy',
    difficulty: 'Novice',
    genre: 'Heist & Cipher',
    locationName: 'Shanghai Museum',
    coordinates: { x: 115, y: 145 },
    summary: 'An imperial jade seal swapped for a 412-gram soapstone replica without tripping alarms.',
    createBundle: createHeist1JadeSeal,
  },
  {
    stageId: 'heist_2_medium',
    categoryId: 'heist',
    categoryLabel: 'Heist & Cipher',
    stageOrder: 2,
    stageLabel: 'Stage II',
    difficultyTier: 'Medium',
    difficulty: 'Adept',
    genre: 'Heist & Cipher',
    locationName: 'Geneva Time-Lock Vault',
    coordinates: { x: 350, y: 92 },
    summary: 'Sapphire cassette stolen 45 minutes early using a magnetized chronometer sleeve.',
    createBundle: createHeist2ClockmakerVault,
  },
  {
    stageId: 'heist_3_hard',
    categoryId: 'heist',
    categoryLabel: 'Heist & Cipher',
    stageOrder: 3,
    stageLabel: 'Stage III',
    difficultyTier: 'Hard',
    difficulty: 'Master',
    genre: 'Heist & Cipher',
    locationName: 'London Maritime Exchange',
    coordinates: { x: 585, y: 145 },
    summary: 'Naval convoy codes leaked over an offline Morse telegraph at midnight.',
    createBundle: createHeist3CipheredTelegraph,
  },
];

export function isStageUnlockedForUser(
  stage: CampaignStage,
  completedStageIds: string[]
): boolean {
  if (stage.stageOrder <= 1) return true;
  if (completedStageIds.includes(stage.stageId)) return true;
  const previousStage = CAMPAIGN_STAGES.find(
    (s) => s.categoryId === stage.categoryId && s.stageOrder === stage.stageOrder - 1
  );
  return previousStage ? completedStageIds.includes(previousStage.stageId) : false;
}
