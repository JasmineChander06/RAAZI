import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import type {
  CandidateQuestion,
  ClueNode,
  DetectiveCase,
  InvestigationTurn,
  Suspect,
} from '../types/mystery.ts';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

function clampStr(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function toTimestampMillis(val: unknown): number {
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (val && typeof val === 'object' && 'seconds' in val && typeof (val as { seconds: number }).seconds === 'number') {
    return (val as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export async function ensureUserProfile(
  user: User,
  explicitName?: string
): Promise<{ unlockedStage: number; completedStageIds: string[] }> {
  const userPath = `users/${user.uid}`;
  const privatePath = `users/${user.uid}/private/info`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const displayName =
      clampStr(explicitName || user.displayName || 'Mystery Seeker', 100) || 'Mystery Seeker';

    let unlockedStage = 1;
    let completedStageIds: string[] = [];

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        solvedCount: 0,
        totalCases: 0,
        unlockedStage: 1,
        completedStageIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const data = snap.data() as {
        unlockedStage?: number;
        completedStageIds?: string[];
      };
      unlockedStage = typeof data.unlockedStage === 'number' ? data.unlockedStage : 1;
      completedStageIds = Array.isArray(data.completedStageIds) ? data.completedStageIds : [];
      await updateDoc(userRef, {
        displayName,
        updatedAt: serverTimestamp(),
      });
    }

    if (user.email) {
      const privateRef = doc(db, 'users', user.uid, 'private', 'info');
      await setDoc(privateRef, {
        uid: user.uid,
        email: clampStr(user.email, 254),
        updatedAt: serverTimestamp(),
      });
    }

    return { unlockedStage, completedStageIds };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${userPath} | ${privatePath}`);
  }
}

export async function recordCampaignStageCompletion(
  uid: string,
  stageId: string,
  nextUnlockedStage: number
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      unlockedStage: nextUnlockedStage,
      completedStageIds: arrayUnion(stageId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserCases(
  uid: string,
  onData: (cases: DetectiveCase[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const casesCol = collection(db, 'cases');
  const q = query(casesCol, where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: DetectiveCase[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<DetectiveCase, 'id'>),
        id: d.id,
      }));
      items.sort((a, b) => toTimestampMillis(b.updatedAt) - toTimestampMillis(a.updatedAt));
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'cases');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function loadCaseDetails(
  uid: string,
  caseId: string
): Promise<{ clues: ClueNode[]; messages: InvestigationTurn[] }> {
  const cluesPath = `cases/${caseId}/clues`;
  const msgsPath = `cases/${caseId}/messages`;

  try {
    const cluesQuery = query(collection(db, 'cases', caseId, 'clues'), where('ownerId', '==', uid));
    const msgsQuery = query(collection(db, 'cases', caseId, 'messages'), where('ownerId', '==', uid));

    const [cluesSnap, msgsSnap] = await Promise.all([getDocs(cluesQuery), getDocs(msgsQuery)]);

    const clues: ClueNode[] = cluesSnap.docs.map((d) => ({
      ...(d.data() as Omit<ClueNode, 'id'>),
      id: d.id,
    }));

    const messages: InvestigationTurn[] = msgsSnap.docs
      .map((d) => ({
        ...(d.data() as Omit<InvestigationTurn, 'id'>),
        id: d.id,
      }))
      .sort((a, b) => toTimestampMillis(a.createdAt) - toTimestampMillis(b.createdAt));

    return { clues, messages };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${cluesPath} | ${msgsPath}`);
  }
}

export async function saveNewCaseToFirestore(
  uid: string,
  caseData: DetectiveCase,
  clues: ClueNode[],
  messages: InvestigationTurn[]
): Promise<string> {
  const caseId = sanitizeId(`${caseData.id}_${Date.now()}`);
  const path = `cases/${caseId}`;

  try {
    const batch = writeBatch(db);
    const caseRef = doc(db, 'cases', caseId);

    batch.set(caseRef, {
      ownerId: uid,
      title: clampStr(caseData.title, 160),
      era: clampStr(caseData.era, 80),
      difficulty: caseData.difficulty,
      synopsis: clampStr(caseData.synopsis, 2400),
      settingDetail: clampStr(caseData.settingDetail, 800),
      status: 'active',
      suspects: caseData.suspects.slice(0, 8),
      culpritId: sanitizeId(caseData.culpritId).slice(0, 64),
      solutionSummary: clampStr(caseData.solutionSummary, 2000),
      ...(caseData.stageId ? { stageId: sanitizeId(caseData.stageId).slice(0, 64) } : {}),
      ...(typeof caseData.stageOrder === 'number' ? { stageOrder: caseData.stageOrder } : {}),
      clueCount: clues.filter((c) => c.discovered).length,
      turnCount: messages.length,
      candidateQuestions: (caseData.candidateQuestions ?? []).slice(0, 12),
      ...(caseData.bannerImageUrl ? { bannerImageUrl: clampStr(caseData.bannerImageUrl, 300) } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const clue of clues) {
      const clueId = sanitizeId(clue.id);
      const clueRef = doc(db, 'cases', caseId, 'clues', clueId);
      batch.set(clueRef, {
        ownerId: uid,
        caseId,
        title: clampStr(clue.title, 140),
        detail: clampStr(clue.detail, 1200),
        category: clue.category,
        source: clue.source,
        discovered: Boolean(clue.discovered),
        connectedNodeIds: clue.connectedNodeIds.slice(0, 12).map(sanitizeId),
        likelihoods: clue.likelihoods,
        createdAt: serverTimestamp(),
      });
    }

    for (const msg of messages) {
      const msgId = sanitizeId(msg.id);
      const msgRef = doc(db, 'cases', caseId, 'messages', msgId);
      batch.set(msgRef, {
        ownerId: uid,
        caseId,
        role: msg.role,
        content: clampStr(msg.content, 4000),
        ...(msg.nlpIntent ? { nlpIntent: clampStr(msg.nlpIntent, 120) } : {}),
        ...(msg.topSuspectName ? { topSuspectName: clampStr(msg.topSuspectName, 120) } : {}),
        ...(typeof msg.topProbability === 'number' ? { topProbability: msg.topProbability } : {}),
        createdAt: serverTimestamp(),
      });
    }

    const userRef = doc(db, 'users', uid);
    batch.update(userRef, {
      totalCases: increment(1),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return caseId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistInvestigationStep(params: {
  uid: string;
  caseId: string;
  updatedSuspects: Suspect[];
  clueCount: number;
  turnCount: number;
  candidateQuestions: CandidateQuestion[];
  newClue?: ClueNode;
  revealedClueIds?: string[];
  updatedClueEdges?: Array<{ clueId: string; connectedNodeIds: string[] }>;
  newMessages: InvestigationTurn[];
}): Promise<void> {
  const {
    uid,
    caseId,
    updatedSuspects,
    clueCount,
    turnCount,
    candidateQuestions,
    newClue,
    revealedClueIds,
    updatedClueEdges,
    newMessages,
  } = params;

  const path = `cases/${caseId}`;
  try {
    const batch = writeBatch(db);
    const caseRef = doc(db, 'cases', caseId);

    batch.update(caseRef, {
      suspects: updatedSuspects.slice(0, 8),
      clueCount,
      turnCount,
      candidateQuestions: candidateQuestions.slice(0, 12),
      updatedAt: serverTimestamp(),
    });

    if (newClue) {
      const clueId = sanitizeId(newClue.id);
      const clueRef = doc(db, 'cases', caseId, 'clues', clueId);
      batch.set(clueRef, {
        ownerId: uid,
        caseId,
        title: clampStr(newClue.title, 140),
        detail: clampStr(newClue.detail, 1200),
        category: newClue.category,
        source: newClue.source,
        discovered: true,
        connectedNodeIds: newClue.connectedNodeIds.slice(0, 12).map(sanitizeId),
        likelihoods: newClue.likelihoods,
        createdAt: serverTimestamp(),
      });
    }

    if (revealedClueIds && revealedClueIds.length > 0) {
      for (const id of revealedClueIds) {
        const clueRef = doc(db, 'cases', caseId, 'clues', sanitizeId(id));
        batch.update(clueRef, {
          discovered: true,
        });
      }
    }

    if (updatedClueEdges && updatedClueEdges.length > 0) {
      for (const edgeUpdate of updatedClueEdges) {
        const clueRef = doc(db, 'cases', caseId, 'clues', sanitizeId(edgeUpdate.clueId));
        batch.update(clueRef, {
          connectedNodeIds: edgeUpdate.connectedNodeIds.slice(0, 12).map(sanitizeId),
        });
      }
    }

    for (const msg of newMessages) {
      const msgRef = doc(db, 'cases', caseId, 'messages', sanitizeId(msg.id));
      batch.set(msgRef, {
        ownerId: uid,
        caseId,
        role: msg.role,
        content: clampStr(msg.content, 4000),
        ...(msg.nlpIntent ? { nlpIntent: clampStr(msg.nlpIntent, 120) } : {}),
        ...(msg.topSuspectName ? { topSuspectName: clampStr(msg.topSuspectName, 120) } : {}),
        ...(typeof msg.topProbability === 'number' ? { topProbability: msg.topProbability } : {}),
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function finalizeCaseAccusation(params: {
  uid: string;
  caseId: string;
  accusedSuspectId: string;
  solvedCorrectly: boolean;
  closingTurn: InvestigationTurn;
}): Promise<void> {
  const { uid, caseId, accusedSuspectId, solvedCorrectly, closingTurn } = params;
  const path = `cases/${caseId}`;

  try {
    const batch = writeBatch(db);
    const caseRef = doc(db, 'cases', caseId);

    batch.update(caseRef, {
      status: 'solved',
      accusedSuspectId: sanitizeId(accusedSuspectId).slice(0, 64),
      solvedCorrectly,
      updatedAt: serverTimestamp(),
    });

    const msgRef = doc(db, 'cases', caseId, 'messages', sanitizeId(closingTurn.id));
    batch.set(msgRef, {
      ownerId: uid,
      caseId,
      role: closingTurn.role,
      content: clampStr(closingTurn.content, 4000),
      ...(closingTurn.nlpIntent ? { nlpIntent: clampStr(closingTurn.nlpIntent, 120) } : {}),
      ...(closingTurn.topSuspectName ? { topSuspectName: clampStr(closingTurn.topSuspectName, 120) } : {}),
      ...(typeof closingTurn.topProbability === 'number'
        ? { topProbability: closingTurn.topProbability }
        : {}),
      createdAt: serverTimestamp(),
    });

    if (solvedCorrectly) {
      const userRef = doc(db, 'users', uid);
      batch.update(userRef, {
        solvedCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCaseFromArchive(uid: string, caseId: string): Promise<void> {
  const path = `cases/${caseId}`;
  try {
    const cluesSnap = await getDocs(
      query(collection(db, 'cases', caseId, 'clues'), where('ownerId', '==', uid))
    );
    const msgsSnap = await getDocs(
      query(collection(db, 'cases', caseId, 'messages'), where('ownerId', '==', uid))
    );

    const batch = writeBatch(db);
    for (const d of cluesSnap.docs) batch.delete(d.ref);
    for (const d of msgsSnap.docs) batch.delete(d.ref);
    batch.delete(doc(db, 'cases', caseId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
