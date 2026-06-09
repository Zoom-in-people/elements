"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "@/lib/firebase";
import { ref, get, set, update, remove, onValue, onDisconnect, runTransaction } from "firebase/database";

interface Card {
  id: number;
  pairId: string;
  content: string;
  isFlipped: boolean;
  matchedBy: "p1" | "p2" | null;
}

interface LeaderboardUser {
  id: string;
  nickname: string;
  totalScore: number;
  wins: number;
  draws: number;
  losses: number;
}

interface UserAccount {
  id: string;
  username: string;
  password: string;
  nickname: string;
  totalScore: number;
}

const CHEMICAL_POOL = [
  { id: "H",  symbol: "H",  name: "수소" },
  { id: "He", symbol: "He", name: "헬륨" },
  { id: "Li", symbol: "Li", name: "리튬" },
  { id: "Be", symbol: "Be", name: "베릴륨" },
  { id: "B",  symbol: "B",  name: "붕소" },
  { id: "C",  symbol: "C",  name: "탄소" },
  { id: "N",  symbol: "N",  name: "질소" },
  { id: "O",  symbol: "O",  name: "산소" },
  { id: "F",  symbol: "F",  name: "플루오린" },
  { id: "Ne", symbol: "Ne", name: "네온" },
  { id: "Na", symbol: "Na", name: "나트륨" },
  { id: "Mg", symbol: "Mg", name: "마그네슘" },
  { id: "Al", symbol: "Al", name: "알루미늄" },
  { id: "Si", symbol: "Si", name: "규소" },
  { id: "P",  symbol: "P",  name: "인" },
  { id: "S",  symbol: "S",  name: "황" },
  { id: "Cl", symbol: "Cl", name: "염소" },
  { id: "Ar", symbol: "Ar", name: "아르곤" },
  { id: "K",  symbol: "K",  name: "칼륨" },
  { id: "Ca", symbol: "Ca", name: "칼슘" },
  { id: "Fe", symbol: "Fe", name: "철" },
  { id: "Mn", symbol: "Mn", name: "망가니즈" },
  { id: "Br", symbol: "Br", name: "브로민" },
  { id: "I",  symbol: "I",  name: "아이오딘" },
  { id: "Ag", symbol: "Ag", name: "은" },
  { id: "Cu", symbol: "Cu", name: "구리" },
  { id: "Au", symbol: "Au", name: "금" },
  { id: "Pb", symbol: "Pb", name: "납" },
  { id: "Zn", symbol: "Zn", name: "아연" },
];

const ION_POOL = [
  { id: "ion_H",    symbol: "H⁺",    name: "수소 이온" },
  { id: "ion_Li",   symbol: "Li⁺",   name: "리튬 이온" },
  { id: "ion_O",    symbol: "O²⁻",   name: "산화 이온" },
  { id: "ion_F",    symbol: "F⁻",    name: "플루오린화 이온" },
  { id: "ion_Na",   symbol: "Na⁺",   name: "나트륨 이온" },
  { id: "ion_Mg",   symbol: "Mg²⁺",  name: "마그네슘 이온" },
  { id: "ion_Al",   symbol: "Al³⁺",  name: "알루미늄 이온" },
  { id: "ion_S",    symbol: "S²⁻",   name: "황화 이온" },
  { id: "ion_Cl",   symbol: "Cl⁻",   name: "염화 이온" },
  { id: "ion_K",    symbol: "K⁺",    name: "칼륨 이온" },
  { id: "ion_Ca",   symbol: "Ca²⁺",  name: "칼슘 이온" },
  { id: "ion_Br",   symbol: "Br⁻",   name: "브로민화 이온" },
  { id: "ion_I",    symbol: "I⁻",    name: "아이오딘화 이온" },
  { id: "ion_NO3",  symbol: "NO₃⁻",  name: "질산 이온" },
  { id: "ion_MnO4", symbol: "MnO₄⁻", name: "과망가니즈산 이온" },
  { id: "ion_Cu",   symbol: "Cu²⁺",  name: "구리 이온(2+)" },
  { id: "ion_Pb",   symbol: "Pb²⁺",  name: "납 이온" },
  { id: "ion_Zn",   symbol: "Zn²⁺",  name: "아연 이온" },
  { id: "ion_SO4",  symbol: "SO₄²⁻", name: "황산 이온" },
  { id: "ion_CO3",  symbol: "CO₃²⁻", name: "탄산 이온" },
];

const DISCONNECT_TIMEOUT_MS = 30000;
const CARD_SELECT_TIMEOUT   = 5;
const MY_TURN_NOTICE_MS     = 2000;

export default function Home() {
  const [gameStatus, setGameStatus] = useState<
    "login" | "signup" | "lobby" | "waiting" | "rps" | "playing" | "finished" | "admin"
  >("login");

  const [userId,       setUserId]       = useState("");
  const [nickname,     setNickname]     = useState("");
  const [myTotalScore, setMyTotalScore] = useState(0);
  // ✅ 수정 1: 이온 기본값을 false로 변경
  const [useElements,  setUseElements]  = useState(true);
  const [useIons,      setUseIons]      = useState(false);

  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formNickname, setFormNickname] = useState("");
  const [authError,    setAuthError]    = useState("");

  const [studentList,  setStudentList]  = useState<UserAccount[]>([]);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [roomId,     setRoomId]     = useState("");
  const [playerRole, setPlayerRole] = useState<"p1" | "p2" | null>(null);
  const [roomData,   setRoomData]   = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);

  const [previewStatus, setPreviewStatus] = useState<"none" | "countdown" | "showAll">("none");
  const [countdownText, setCountdownText] = useState("");
  const [cards,         setCards]         = useState<Card[]>([]);
  const [flippedIndexes, setFlippedIndexes] = useState<number[]>([]);
  const [currentTurn,   setCurrentTurn]   = useState<"p1" | "p2">("p1");
  const [comboCount,    setComboCount]    = useState(0);
  const [scores,        setScores]        = useState({ p1: 0, p2: 0 });
  const [isLocked,      setIsLocked]      = useState(false);
  const [showRanking,   setShowRanking]   = useState(false);

  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [disconnectCountdown,  setDisconnectCountdown]  = useState(0);
  const disconnectTimerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const disconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scoreAppliedRef   = useRef(false);
  const previewStartedRef = useRef(false);

  const [cardTimerSec,    setCardTimerSec]    = useState(0);
  const cardTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const [firstCardPicked, setFirstCardPicked] = useState(false);

  // ✅ 수정 4: "내 차례!" 알림 관련 — gameReady 플래그 추가
  const [showMyTurnNotice,  setShowMyTurnNotice]  = useState(false);
  const [showMaxComboNotice, setShowMaxComboNotice] = useState(false);
  const prevTurnRef  = useRef<"p1" | "p2" | null>(null);
  // 게임판이 실제로 플레이 가능 상태가 되었을 때만 true
  const gameReadyRef = useRef(false);

  // ── 카드 타이머 헬퍼 ─────────────────────────────────────────
  const clearCardTimer = useCallback(() => {
    if (cardTimerRef.current) {
      clearInterval(cardTimerRef.current);
      cardTimerRef.current = null;
    }
    setCardTimerSec(0);
  }, []);

  const startCardTimer = useCallback((onExpire: () => void) => {
    clearCardTimer();
    setCardTimerSec(CARD_SELECT_TIMEOUT);
    let remaining = CARD_SELECT_TIMEOUT;
    cardTimerRef.current = setInterval(() => {
      remaining -= 1;
      setCardTimerSec(remaining);
      if (remaining <= 0) {
        clearInterval(cardTimerRef.current!);
        cardTimerRef.current = null;
        setCardTimerSec(0);
        onExpire();
      }
    }, 1000);
  }, [clearCardTimer]);

  // ── ✅ 수정 5: 창 닫으면 자동 로그아웃 ──────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.removeItem("element_game_user_id");
      localStorage.removeItem("element_game_room_id");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ── 초기화 ───────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const currentUserId = localStorage.getItem("element_game_user_id");
      const savedRoomId   = localStorage.getItem("element_game_room_id");
      if (currentUserId) {
        setUserId(currentUserId);
        if (savedRoomId) {
          const snap = await get(ref(db, `rooms/${savedRoomId}`));
          if (snap.exists()) {
            const room = snap.val();
            if (
              (room.p1 === currentUserId || room.p2 === currentUserId) &&
              room.status !== "finished"
            ) {
              setRoomId(savedRoomId);
              setPlayerRole(room.p1 === currentUserId ? "p1" : "p2");
              setGameStatus(room.status);
              if (room.status === "playing") {
                previewStartedRef.current = true;
                gameReadyRef.current      = true;
                setPreviewStatus("none");
                setIsLocked(false);
              }
              return;
            }
          }
          localStorage.removeItem("element_game_room_id");
        }
        setGameStatus("lobby");
      } else {
        setGameStatus("login");
      }
    };
    init();
  }, []);

  // ── 전체 유저 / 랭킹 리스너 ─────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const allUsersRef = ref(db, "users");
    const unsub = onValue(allUsersRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list: LeaderboardUser[] = Object.keys(data).map((key) => ({
          id:         key,
          nickname:   data[key].nickname   || "무명 원소",
          totalScore: data[key].totalScore || 0,
          wins:       data[key].wins       || 0,
          draws:      data[key].draws      || 0,
          losses:     data[key].losses     || 0,
        }));
        list.sort((a, b) => b.totalScore - a.totalScore);
        setLeaderboard(list);
      }
    });
    const myRef   = ref(db, `users/${userId}`);
    const myUnsub = onValue(myRef, (snap) => {
      if (snap.exists()) {
        setMyTotalScore(snap.val().totalScore || 0);
        setNickname(snap.val().nickname || "");
      }
    });
    return () => { unsub(); myUnsub(); };
  }, [userId]);

  // ── 관리자 목록 리스너 ───────────────────────────────────────
  useEffect(() => {
    if (gameStatus !== "admin") return;
    const unsub = onValue(ref(db, "users"), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list: UserAccount[] = Object.keys(data).map((key) => ({
          id:         key,
          username:   data[key].username   || key,
          password:   data[key].password   || "",
          nickname:   data[key].nickname   || "",
          totalScore: data[key].totalScore || 0,
        }));
        setStudentList(list);
      } else setStudentList([]);
    });
    return () => unsub();
  }, [gameStatus]);

  // ── ✅ 수정 4: 암기 타이머 — 끝난 뒤에 gameReady 플래그 ON ─
  useEffect(() => {
    if (gameStatus === "playing" && !previewStartedRef.current) {
      previewStartedRef.current = true;
      gameReadyRef.current      = false;  // 아직 암기 중 → 알림 비활성
      setIsLocked(true);
      setPreviewStatus("countdown");
      setCountdownText("3");
      const t1 = setTimeout(() => setCountdownText("2"), 1000);
      const t2 = setTimeout(() => setCountdownText("1"), 2000);
      const t3 = setTimeout(() => setPreviewStatus("showAll"), 3000);
      const t4 = setTimeout(() => {
        setPreviewStatus("none");
        setIsLocked(false);
        // 암기 완료 → 이제부터 "내 차례!" 알림 허용
        gameReadyRef.current  = true;
        prevTurnRef.current   = null;   // 강제 리셋 → 첫 턴 알림 트리거
        setCurrentTurn((t) => t);       // 리렌더 유도
      }, 13000);
      return () => {
        clearTimeout(t1); clearTimeout(t2);
        clearTimeout(t3); clearTimeout(t4);
      };
    }
  }, [gameStatus]);

  // ── ✅ 수정 4: "내 차례!" 알림 — gameReady + previewStatus 조건 강화 ──
  useEffect(() => {
    if (
      gameStatus === "playing" &&
      gameReadyRef.current &&
      previewStatus === "none" &&
      playerRole &&
      currentTurn === playerRole &&
      prevTurnRef.current !== playerRole
    ) {
      prevTurnRef.current = playerRole;
      setShowMyTurnNotice(true);
      setIsLocked(true);
      clearCardTimer();
      const t = setTimeout(() => {
        setShowMyTurnNotice(false);
        setIsLocked(false);
        startCardTimer(() => {
          if (playerRole) {
            update(ref(db, `rooms/${roomId}`), {
              currentTurn: playerRole === "p1" ? "p2" : "p1",
              comboCount:  0,
            });
          }
          setFirstCardPicked(false);
        });
      }, MY_TURN_NOTICE_MS);
      return () => clearTimeout(t);
    }
    // 상대 턴으로 바뀌면 prevTurnRef를 상대방으로 업데이트
    if (currentTurn !== playerRole) {
      prevTurnRef.current = currentTurn;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn, gameStatus, previewStatus]);

  // ── 상대방 온라인 감지 ───────────────────────────────────────
  useEffect(() => {
    if (!roomId || !playerRole || !["rps", "playing"].includes(gameStatus)) return;
    const opRole      = playerRole === "p1" ? "p2" : "p1";
    const opOnlineRef = ref(db, `rooms/${roomId}/${opRole}_online`);
    const unsub = onValue(opOnlineRef, (snap) => {
      const isOnline = snap.val();
      if (isOnline === false) {
        if (!opponentDisconnected) {
          setOpponentDisconnected(true);
          setDisconnectCountdown(DISCONNECT_TIMEOUT_MS / 1000);
          disconnectIntervalRef.current = setInterval(() => {
            setDisconnectCountdown((prev) => {
              if (prev <= 1) { clearInterval(disconnectIntervalRef.current!); return 0; }
              return prev - 1;
            });
          }, 1000);
          disconnectTimerRef.current = setTimeout(() => {
            const forceScores = { [playerRole]: 10, [opRole]: 0 };
            update(ref(db, `rooms/${roomId}`), {
              scores: forceScores, status: "finished", forfeitWinner: playerRole,
            });
          }, DISCONNECT_TIMEOUT_MS);
        }
      } else {
        if (opponentDisconnected) {
          setOpponentDisconnected(false);
          setDisconnectCountdown(0);
          if (disconnectTimerRef.current)    clearTimeout(disconnectTimerRef.current);
          if (disconnectIntervalRef.current) clearInterval(disconnectIntervalRef.current);
        }
      }
    });
    return () => {
      unsub();
      if (disconnectTimerRef.current)    clearTimeout(disconnectTimerRef.current);
      if (disconnectIntervalRef.current) clearInterval(disconnectIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerRole, gameStatus]);

  // ── 내 온라인 상태 등록 ──────────────────────────────────────
  useEffect(() => {
    if (!roomId || !playerRole || !["rps", "playing"].includes(gameStatus)) return;
    const myOnlineRef = ref(db, `rooms/${roomId}/${playerRole}_online`);
    set(myOnlineRef, true);
    onDisconnect(myOnlineRef).set(false);
  }, [roomId, playerRole, gameStatus]);

  // ── 방 데이터 실시간 리스너 ──────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsub   = onValue(roomRef, (snap) => {
      const data = snap.val();
      if (data) {
        setRoomData(data);
        if (data.status)                   setGameStatus(data.status);
        if (data.board)                    setCards(data.board);
        if (data.currentTurn)              setCurrentTurn(data.currentTurn);
        if (data.scores)                   setScores(data.scores);
        if (data.comboCount !== undefined) setComboCount(data.comboCount);
        if (playerRole === "p1" && data.status !== "waiting") onDisconnect(roomRef).cancel();
      }
    });
    return () => unsub();
  }, [roomId, playerRole]);

  // ── 가위바위보 결과 (p1만 실행) ─────────────────────────────
  useEffect(() => {
    if (gameStatus === "rps" && playerRole === "p1" && roomData?.p1_rps && roomData?.p2_rps) {
      const p1 = roomData.p1_rps, p2 = roomData.p2_rps;
      const timer = setTimeout(() => {
        if (p1 === p2) {
          update(ref(db, `rooms/${roomId}`), { p1_rps: null, p2_rps: null });
        } else {
          const p1Wins =
            (p1 === "rock"     && p2 === "scissors") ||
            (p1 === "scissors" && p2 === "paper")    ||
            (p1 === "paper"    && p2 === "rock");
          update(ref(db, `rooms/${roomId}`), {
            status: "playing", currentTurn: p1Wins ? "p1" : "p2",
          });
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gameStatus, playerRole, roomData?.p1_rps, roomData?.p2_rps, roomId]);

  // ── 카드 전부 매칭 시 게임 종료 (p1만) ──────────────────────
  useEffect(() => {
    if (gameStatus === "playing" && scores.p1 + scores.p2 === 10) {
      clearCardTimer();
      if (playerRole === "p1") update(ref(db, `rooms/${roomId}`), { status: "finished" });
    }
  }, [scores, gameStatus, playerRole, roomId, clearCardTimer]);

  // ── 점수 적립 ───────────────────────────────────────────────
  useEffect(() => {
    if (gameStatus === "finished" && playerRole && !scoreAppliedRef.current) {
      scoreAppliedRef.current = true;
      clearCardTimer();
      const myScore = scores[playerRole];
      const opScore = scores[playerRole === "p1" ? "p2" : "p1"];
      let earnedPoints = 0;
      let resultKey: "wins" | "draws" | "losses";
      if      (myScore > opScore)  { earnedPoints = 3; resultKey = "wins"; }
      else if (myScore === opScore) { earnedPoints = 2; resultKey = "draws"; }
      else                          { earnedPoints = 1; resultKey = "losses"; }

      get(ref(db, `users/${userId}`)).then((snap) => {
        const d = snap.val() || {};
        update(ref(db, `users/${userId}`), {
          totalScore: (d.totalScore || 0) + earnedPoints,
          wins:       (d.wins   || 0) + (resultKey === "wins"   ? 1 : 0),
          draws:      (d.draws  || 0) + (resultKey === "draws"  ? 1 : 0),
          losses:     (d.losses || 0) + (resultKey === "losses" ? 1 : 0),
        });
      });
    }
  }, [gameStatus, playerRole, scores, userId, clearCardTimer]);

  // ── 핸들러: 회원가입 ─────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError("");
    if (!formUsername || !formPassword || !formNickname) { setAuthError("모든 칸을 입력해 주세요."); return; }
    if (formUsername === "admin") { setAuthError("사용할 수 없는 아이디입니다."); return; }
    const userRef = ref(db, `users/${formUsername}`);
    if ((await get(userRef)).exists()) { setAuthError("이미 존재하는 아이디입니다."); return; }
    await set(userRef, {
      username: formUsername, password: formPassword,
      nickname: formNickname, totalScore: 0, wins: 0, draws: 0, losses: 0,
    });
    alert("회원가입이 완료되었습니다! 로그인해 주세요.");
    setGameStatus("login"); setFormNickname(""); setFormPassword("");
  };

  // ── 핸들러: 로그인 ───────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError("");
    if (formUsername === "admin" && formPassword === "teacherpw") {
      setGameStatus("admin"); setFormUsername(""); setFormPassword(""); return;
    }
    const snap = await get(ref(db, `users/${formUsername}`));
    if (!snap.exists()) { setAuthError("존재하지 않는 아이디입니다."); return; }
    const userData = snap.val();
    if (userData.password !== formPassword) { setAuthError("비밀번호가 일치하지 않습니다."); return; }
    localStorage.setItem("element_game_user_id", formUsername);
    setUserId(formUsername); setNickname(userData.nickname);
    setMyTotalScore(userData.totalScore || 0);
    setGameStatus("lobby"); setFormUsername(""); setFormPassword("");
  };

  const saveStudentEdit = async (id: string) => {
    if (!editNickname || !editPassword) { alert("공백으로 수정할 수 없습니다."); return; }
    await update(ref(db, `users/${id}`), { nickname: editNickname, password: editPassword });
    setEditingId(null);
  };
  const deleteStudent = async (id: string) => {
    if (confirm(`정말로 이 학생(${id}) 계정을 삭제하시겠습니까?\n누적 점수도 함께 사라집니다.`))
      await remove(ref(db, `users/${id}`));
  };

  // ── 카드 보드 생성 헬퍼 (트랜잭션 밖에서 호출) ─────────────
  const buildBoard = () => {
    let selectedPairs: any[] = [];
    if (useElements && !useIons)
      selectedPairs = [...CHEMICAL_POOL].sort(() => Math.random() - 0.5).slice(0, 10);
    else if (!useElements && useIons)
      selectedPairs = [...ION_POOL].sort(() => Math.random() - 0.5).slice(0, 10);
    else
      selectedPairs = [
        ...[...CHEMICAL_POOL].sort(() => Math.random() - 0.5).slice(0, 5),
        ...[...ION_POOL].sort(() => Math.random() - 0.5).slice(0, 5),
      ];
    const rawData: any[] = [];
    selectedPairs.forEach((elem) => {
      rawData.push({ pairId: elem.id, content: elem.symbol, isFlipped: false, matchedBy: null });
      rawData.push({ pairId: elem.id, content: elem.name,   isFlipped: false, matchedBy: null });
    });
    rawData.sort(() => Math.random() - 0.5);
    return rawData.map((card, idx) => ({ ...card, id: idx }));
  };

// ── 게임 참가 ────────────────────────────────────────────────
  // 핵심 전략:
  //   1) 트랜잭션은 "p2 자리 선점" 만 담당하여 동시 접속(3명 버그) 완벽 차단
  //   2) 선점 성공 후 방 상태 최종 확인 및 보드 세팅
  const joinGame = async () => {
    if (!useElements && !useIons) {
      alert("원소기호와 이온 중 최소 하나는 선택해야 합니다.");
      return;
    }
    setGameStatus("waiting");

    const snap = await get(ref(db, "rooms"));
    let joinedRoomId: string | null = null;

    if (snap.exists()) {
      const rooms = snap.val();
      const candidateKeys = Object.keys(rooms).filter(
        (key) =>
          rooms[key].status === "waiting" &&
          rooms[key].p1 !== userId &&
          !rooms[key].p2 &&                  // p2가 아직 없는 방만
          rooms[key].mode?.elements === useElements &&
          rooms[key].mode?.ions     === useIons
      );

      for (const key of candidateKeys) {
        // 🔥 수정된 부분: 방 전체가 아닌 'p2' 필드 하나만 트랜잭션으로 잠금 시도
        const p2Ref = ref(db, `rooms/${key}/p2`);
        let committed = false;

        await runTransaction(p2Ref, (current) => {
          if (current === null) {
            return userId; // p2 자리가 비어있으면 내 ID로 즉시 선점
          }
          return undefined; // 누군가 0.1초 차이로 먼저 선점했다면 취소(abort)
        }).then((result) => {
          committed = result.committed;
        }).catch(() => {});

        if (committed) {
          // p2 자리를 성공적으로 차지함! 방장이 그 사이 취소하지 않았는지 최종 확인
          const statusSnap = await get(ref(db, `rooms/${key}/status`));
          if (statusSnap.val() === "waiting") {
            // 유효한 방이므로 게임 세팅 진행
            const board = buildBoard();
            await update(ref(db, `rooms/${key}`), {
              status:    "rps",
              board,
              scores:    { p1: 0, p2: 0 },
              comboCount: 0,
              p1_rps:    null,
              p2_rps:    null,
              p1_online: true,
              p2_online: true,
            });
            joinedRoomId = key;
            break; // 매칭 성공, 루프 탈출
          } else {
            // 찰나의 순간에 방장이 취소했거나 이상이 생겼다면 롤백
            await set(p2Ref, null);
          }
        }
      }
    }

    if (joinedRoomId) {
      localStorage.setItem("element_game_room_id", joinedRoomId);
      setRoomId(joinedRoomId);
      setPlayerRole("p2");
    } else {
      // 빈 방 없음 → 새 방 생성
      const newRoomId  = `room_${Date.now()}_${userId}`;
      const newRoomRef = ref(db, `rooms/${newRoomId}`);
      await set(newRoomRef, {
        p1:     userId,
        status: "waiting",
        mode:   { elements: useElements, ions: useIons },
        p1_online: true,
      });
      localStorage.setItem("element_game_room_id", newRoomId);
      onDisconnect(newRoomRef).remove();
      setRoomId(newRoomId);
      setPlayerRole("p1");
    }
  };

  const cancelMatching = async () => {
    if (!roomId) return;
    setIsLocked(true);
    try {
      const roomRef = ref(db, `rooms/${roomId}`);
      await onDisconnect(roomRef).cancel();
      await remove(roomRef);
      localStorage.removeItem("element_game_room_id");
      setRoomId(""); setPlayerRole(null); setGameStatus("lobby");
    } catch (e) { console.error(e); } finally { setIsLocked(false); }
  };

  // ── 가위바위보 나가기 (패배 처리 없이 단순 취소) ────────────
  const leaveRps = async () => {
    if (!confirm("가위바위보를 취소하고 로비로 돌아가시겠습니까?")) return;
    if (roomId) {
      try {
        const roomRef = ref(db, `rooms/${roomId}`);
        const snap    = await get(roomRef);
        if (snap.exists()) {
          const room   = snap.val();
          const opRole = playerRole === "p1" ? "p2" : "p1";
          if (room[opRole]) {
            // 상대방이 이미 있는 경우 → 상대방을 p1로 남기고 방을 대기 상태로 초기화
            // (상대방은 로비로 강제 이동되지 않고 계속 새 매칭을 기다릴 수 있음)
            await update(roomRef, {
              [playerRole === "p1" ? "p1" : "p2"]: null,
              p2:        playerRole === "p2" ? null : room.p2,
              p1:        playerRole === "p1" ? room.p2 : room.p1, // 남은 사람을 p1으로
              status:    "waiting",
              board:     null,
              scores:    null,
              comboCount: null,
              p1_rps:    null,
              p2_rps:    null,
              p2_online: playerRole === "p2" ? null : room.p2_online,
            });
          } else {
            // 나 혼자인 방 → 삭제
            await remove(roomRef);
          }
        }
      } catch (e) { console.error(e); }
    }
    localStorage.removeItem("element_game_room_id");
    setRoomId(""); setPlayerRole(null); setRoomData(null);
    setGameStatus("lobby");
  };

  // ── 핸들러: 게임 중 포기 ────────────────────────────────────
  const handleForfeit = async () => {
    if (!playerRole || !roomId) return;
    if (!confirm("게임을 포기하시겠습니까? 패배 처리되며 승점을 얻지 못합니다.")) return;
    clearCardTimer();
    const opRole      = playerRole === "p1" ? "p2" : "p1";
    const forceScores = { [playerRole]: 0, [opRole]: 10 };
    await update(ref(db, `rooms/${roomId}`), {
      scores: forceScores, status: "finished", forfeitWinner: opRole,
    });
  };

  const handleRpsSelect = (choice: string) => {
    update(ref(db, `rooms/${roomId}`), { [`${playerRole}_rps`]: choice });
  };

  // ── 핸들러: 카드 클릭 ────────────────────────────────────────
  const handleCardClick = (clickedCard: Card) => {
    if (currentTurn !== playerRole || previewStatus !== "none") return;
    if (isLocked || clickedCard.isFlipped || clickedCard.matchedBy) return;
    if (showMyTurnNotice) return;

    const newFlipped = [...flippedIndexes, clickedCard.id];
    setFlippedIndexes(newFlipped);
    update(ref(db, `rooms/${roomId}/board/${clickedCard.id}`), { isFlipped: true });

    if (newFlipped.length === 1) {
      setFirstCardPicked(true);
      clearCardTimer();
      startCardTimer(() => {
        update(ref(db, `rooms/${roomId}`), {
          [`board/${clickedCard.id}/isFlipped`]: false,
          currentTurn: playerRole === "p1" ? "p2" : "p1",
          comboCount:  0,
        });
        setFlippedIndexes([]);
        setFirstCardPicked(false);
        setIsLocked(false);
      });
      return;
    }

    if (newFlipped.length === 2) {
      clearCardTimer();
      setIsLocked(true);
      setFirstCardPicked(false);
      const [idx1, idx2] = newFlipped;
      const card1 = cards[idx1];
      const card2 = cards[idx2];

      if (card1.pairId === card2.pairId) {
        setTimeout(() => {
          const newCombo   = comboCount + 1;
          const maxReached = newCombo >= 3;
          const nextTurn   = maxReached ? (currentTurn === "p1" ? "p2" : "p1") : currentTurn;
          const nextCombo  = maxReached ? 0 : newCombo;
          const newScores  = { ...scores, [currentTurn]: scores[currentTurn] + 1 };

          if (maxReached) {
            setShowMaxComboNotice(true);
            setTimeout(() => setShowMaxComboNotice(false), 2500);
          }

          update(ref(db, `rooms/${roomId}`), {
            [`board/${idx1}/matchedBy`]: currentTurn,
            [`board/${idx2}/matchedBy`]: currentTurn,
            scores:      newScores,
            currentTurn: nextTurn,
            comboCount:  nextCombo,
          });
          setFlippedIndexes([]);
          setIsLocked(false);
        }, 500);
      } else {
        setTimeout(() => {
          update(ref(db, `rooms/${roomId}`), {
            [`board/${idx1}/isFlipped`]: false,
            [`board/${idx2}/isFlipped`]: false,
            currentTurn: currentTurn === "p1" ? "p2" : "p1",
            comboCount:  0,
          });
          setFlippedIndexes([]);
          setIsLocked(false);
        }, 700);
      }
    }
  };

  const getEmoji = (choice: string) =>
    ({ rock: "✊", paper: "🖐️", scissors: "✌️" }[choice] ?? "🤔");

  const handleLogout = () => {
    localStorage.removeItem("element_game_user_id");
    localStorage.removeItem("element_game_room_id");
    setUserId(""); setNickname(""); setMyTotalScore(0); setGameStatus("login");
  };

  const leaveRoom = () => {
    scoreAppliedRef.current   = false;
    previewStartedRef.current = false;
    gameReadyRef.current      = false;
    prevTurnRef.current       = null;
    clearCardTimer();
    if (disconnectTimerRef.current)    clearTimeout(disconnectTimerRef.current);
    if (disconnectIntervalRef.current) clearInterval(disconnectIntervalRef.current);
    localStorage.removeItem("element_game_room_id");
    setGameStatus("lobby");
    setRoomId(""); setPlayerRole(null); setRoomData(null); setCards([]);
    setScores({ p1: 0, p2: 0 }); setComboCount(0); setCurrentTurn("p1");
    setPreviewStatus("none"); setFlippedIndexes([]);
    setOpponentDisconnected(false); setDisconnectCountdown(0);
    setFirstCardPicked(false); setShowMyTurnNotice(false); setShowMaxComboNotice(false);
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4 select-none">

      {/* ── 1. 로그인 ── */}
      {gameStatus === "login" && (
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-8 border-blue-600">
          <h2 className="text-3xl font-black text-center mb-2 text-slate-800">🧪 원소 대전 로그인</h2>
          <p className="text-sm text-center text-gray-400 mb-6">자신의 기록을 유지하고 대결에 참여하세요!</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">아이디</label>
              <input type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl focus:outline-blue-500 text-black" placeholder="아이디 입력" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">비밀번호</label>
              <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl focus:outline-blue-500 text-black" placeholder="비밀번호 입력" />
            </div>
            {authError && <p className="text-xs font-bold text-red-500">{authError}</p>}
            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors">로그인</button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => { setGameStatus("signup"); setAuthError(""); }}
              className="text-sm font-semibold text-blue-500 hover:underline">계정이 없으신가요? 회원가입</button>
          </div>
        </div>
      )}

      {/* ── 2. 회원가입 ── */}
      {gameStatus === "signup" && (
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-8 border-green-600">
          <h2 className="text-3xl font-black text-center mb-2 text-slate-800">회원가입</h2>
          <p className="text-sm text-center text-gray-400 mb-6">새로운 연구원 정보를 등록합니다.</p>
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">아이디</label>
              <input type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl focus:outline-green-500 text-black" placeholder="사용할 아이디" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">비밀번호</label>
              <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl focus:outline-green-500 text-black" placeholder="사용할 비밀번호" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">닉네임</label>
              <input type="text" value={formNickname} onChange={(e) => setFormNickname(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl focus:outline-green-500 text-black" placeholder="학급 명렬 이름 또는 별명" />
            </div>
            {authError && <p className="text-xs font-bold text-red-500">{authError}</p>}
            <button type="submit" className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md transition-colors">가입하기</button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => { setGameStatus("login"); setAuthError(""); }}
              className="text-sm font-semibold text-green-500 hover:underline">이미 계정이 있습니다 로그인</button>
          </div>
        </div>
      )}

      {/* ── 3. 관리자 ── */}
      {gameStatus === "admin" && (
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl border-t-8 border-purple-600">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-3xl font-black text-slate-800">👨‍🏫 학생 계정 종합 관리실</h2>
              <p className="text-sm text-gray-400">학생 정보의 실시간 확인, 수정 및 삭제가 가능합니다.</p>
            </div>
            <button onClick={() => setGameStatus("login")}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-xl shadow-sm text-sm">관리자 로그아웃</button>
          </div>
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-left border-collapse text-black text-sm">
              <thead>
                <tr className="bg-slate-100 font-bold border-b text-slate-700">
                  <th className="p-3">아이디</th><th className="p-3">비밀번호</th>
                  <th className="p-3">닉네임</th><th className="p-3">누적 승점</th>
                  <th className="p-3 text-center">관리 액션</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {studentList.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-gray-600">{student.username}</td>
                    <td className="p-3">
                      {editingId === student.id
                        ? <input type="text" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="border px-2 py-1 rounded w-32 focus:outline-purple-500" />
                        : <span className="font-mono text-gray-500">{student.password}</span>}
                    </td>
                    <td className="p-3">
                      {editingId === student.id
                        ? <input type="text" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} className="border px-2 py-1 rounded w-32 focus:outline-purple-500" />
                        : <span className="font-bold text-slate-700">{student.nickname}</span>}
                    </td>
                    <td className="p-3 font-black text-blue-600">{student.totalScore}점</td>
                    <td className="p-3 text-center space-x-2">
                      {editingId === student.id ? (
                        <>
                          <button onClick={() => saveStudentEdit(student.id)} className="px-3 py-1 bg-green-500 text-white font-bold rounded text-xs">저장</button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-gray-400 text-white font-bold rounded text-xs">취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(student.id); setEditNickname(student.nickname); setEditPassword(student.password); }}
                            className="px-3 py-1 bg-amber-500 text-white font-bold rounded text-xs hover:bg-amber-600">수정</button>
                          <button onClick={() => deleteStudent(student.id)}
                            className="px-3 py-1 bg-red-500 text-white font-bold rounded text-xs hover:bg-red-600">삭제</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. 로비 ── */}
      {gameStatus === "lobby" && (
        <>
          <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-8 border-blue-600">
            <div className="text-right mb-2">
              <button onClick={handleLogout} className="text-xs font-bold text-gray-400 hover:text-red-500 hover:underline">로그아웃</button>
            </div>
            <div className="text-center mt-2">
              <h1 className="text-4xl font-black mb-2 text-slate-800">🧪 원소 기호 대전</h1>
              <p className="text-gray-400 mb-6">연구원 정보: <span className="text-slate-700 font-bold">{nickname} ({userId})</span></p>

              <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-gray-200 text-black text-left">
                <div className="text-xs font-bold text-gray-400 mb-2">게임 출제 범위 설정</div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center py-2">
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-sm">
                    <input type="checkbox" checked={useElements} onChange={(e) => setUseElements(e.target.checked)} className="w-5 h-5 accent-blue-600" />
                    원소기호 모음
                  </label>
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-sm">
                    <input type="checkbox" checked={useIons} onChange={(e) => setUseIons(e.target.checked)} className="w-5 h-5 accent-blue-600" />
                    이온세트 모음
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl mb-6">
                <div className="text-sm text-blue-500 font-bold mb-1">내 누적 승점</div>
                <div className="text-4xl font-black text-blue-600">{myTotalScore}점</div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowRanking(true)} className="flex-[1] py-4 bg-amber-500 text-white text-lg font-bold rounded-xl hover:bg-amber-600 shadow-md transition-all">
                🏆 랭킹
              </button>
              <button onClick={joinGame} className="flex-[2] py-4 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 shadow-md transition-all">
                게임 참가하기 ⚔️
              </button>
            </div>
          </div>

          {/* 🏆 랭킹 팝업 */}
          {showRanking && (
            <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col max-h-[80vh] border-t-8 border-amber-500 overflow-hidden">
                <div className="p-5 border-b flex justify-between items-center bg-slate-50">
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    🏆 우수 연구원 랭킹
                  </h2>
                  <button onClick={() => setShowRanking(false)} className="text-gray-400 hover:text-gray-700 font-bold text-3xl leading-none">
                    &times;
                  </button>
                </div>
                <div className="overflow-y-auto p-5 space-y-2 flex-1">
                  {leaderboard.map((user, index) => {
                    const isMe = user.id === userId;
                    return (
                      <div key={user.id} className={`flex justify-between items-center p-3 rounded-lg text-sm font-semibold ${isMe ? "bg-amber-100 border border-amber-400 text-amber-900" : "bg-slate-50 text-slate-700"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-5 text-center font-bold ${index < 3 ? "text-amber-500" : "text-gray-400"}`}>{index + 1}</span>
                          <span className="truncate max-w-[120px]">{user.nickname}</span>
                        </div>
                        <span className="font-black">{user.totalScore}점</span>
                      </div>
                    );
                  })}
                  {leaderboard.length === 0 && (
                    <div className="text-center text-gray-400 font-bold py-4">아직 랭킹 기록이 없습니다.</div>
                  )}
                </div>
                <div className="p-4 border-t bg-white">
                  <button onClick={() => setShowRanking(false)} className="w-full py-3 bg-slate-200 text-slate-800 font-bold rounded-xl hover:bg-slate-300 transition-colors">
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 5. 대기 ── */}
      {gameStatus === "waiting" && (
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center animate-pulse max-w-md w-full">
          <div className="text-6xl mb-4">👀</div>
          <h2 className="text-2xl font-bold text-slate-700 mb-4">동일 모드의 상대방을 매칭 중입니다...</h2>
          <button onClick={cancelMatching}
            className="mt-6 px-6 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-sm transition-colors text-sm">
            매칭 취소하고 로비로 돌아가기
          </button>
        </div>
      )}

      {/* ── 6. 가위바위보 ── */}
      {gameStatus === "rps" && (
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center w-full max-w-2xl">
          {opponentDisconnected && (
            <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-xl text-red-700 font-bold">
              ⚠️ 상대방 연결이 끊겼습니다. {disconnectCountdown}초 안에 돌아오지 않으면 자동 승리 처리됩니다.
            </div>
          )}
          <h2 className="text-3xl font-black mb-8 text-slate-800">✊✌️🖐️ 가위바위보!</h2>
          <div className="flex justify-around items-center mb-10">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-blue-600 mb-2">나 ({playerRole})</span>
              <div className="text-6xl bg-slate-100 p-6 rounded-2xl">
                {roomData?.[`${playerRole}_rps`] ? getEmoji(roomData[`${playerRole}_rps`]) : "❓"}
              </div>
            </div>
            <div className="text-4xl font-black text-slate-300">VS</div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-red-600 mb-2">상대방</span>
              <div className="text-6xl bg-slate-100 p-6 rounded-2xl">
                {roomData?.p1_rps && roomData?.p2_rps
                  ? getEmoji(playerRole === "p1" ? roomData.p2_rps : roomData.p1_rps)
                  : roomData?.[playerRole === "p1" ? "p2_rps" : "p1_rps"] ? "✔️" : "⏳"}
              </div>
            </div>
          </div>
          {roomData?.p1_rps && roomData?.p2_rps && roomData.p1_rps === roomData.p2_rps && (
            <div className="text-2xl font-bold text-red-500 mb-4 animate-bounce">무승부! 다시 선택하세요!</div>
          )}
          {!roomData?.[`${playerRole}_rps`] && (
            <div className="flex justify-center gap-4 mb-8">
              <button onClick={() => handleRpsSelect("scissors")} className="text-5xl hover:scale-110 bg-gray-100 p-4 rounded-xl">✌️</button>
              <button onClick={() => handleRpsSelect("rock")}     className="text-5xl hover:scale-110 bg-gray-100 p-4 rounded-xl">✊</button>
              <button onClick={() => handleRpsSelect("paper")}    className="text-5xl hover:scale-110 bg-gray-100 p-4 rounded-xl">🖐️</button>
            </div>
          )}
          {/* ✅ 수정 3: 가위바위보 나가기 버튼 */}
          <div className="border-t pt-6">
            <button onClick={leaveRps}
              className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-sm transition-colors text-sm">
              🚪 포기하고 로비로 돌아가기
            </button>
          </div>
        </div>
      )}

      {/* ── 7. 본 게임 ── */}
      {gameStatus === "playing" && (
        <>
          {previewStatus === "countdown" && (
            <div className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-center text-white">
              <div className="text-8xl font-black mb-4 tracking-wider text-amber-400 animate-ping">{countdownText}</div>
              <p className="text-xl font-bold">잠시 후 게임판이 전체 공개됩니다!</p>
            </div>
          )}
          {previewStatus === "showAll" && (
            <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center py-3 font-black text-xl z-50 shadow-md animate-pulse">
              ⚡ 👀 10초 동안 카드를 잘 기억하세요! ⚡
            </div>
          )}

          {opponentDisconnected && (
            <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-3 font-black text-lg z-50 shadow-md">
              ⚠️ 상대방 연결 끊김! {disconnectCountdown}초 안에 돌아오지 않으면 자동 승리 처리됩니다.
            </div>
          )}

          {/* ✅ 수정 4: "내 차례!" — previewStatus 조건 추가로 이중 차단 */}
          {showMyTurnNotice && previewStatus === "none" && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center pointer-events-none">
              <div className="bg-green-500 text-white px-16 py-10 rounded-3xl shadow-2xl text-center animate-bounce">
                <div className="text-6xl mb-3">🔔</div>
                <div className="text-4xl font-black">내 차례입니다!</div>
              </div>
            </div>
          )}

          {showMaxComboNotice && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center pointer-events-none">
              <div className="bg-gradient-to-br from-orange-400 to-red-500 text-white px-12 py-8 rounded-3xl shadow-2xl text-center">
                <div className="text-5xl mb-3">🔥</div>
                <div className="text-3xl font-black leading-snug">연속 최대 3번 정답에<br/>도달했습니다!</div>
              </div>
            </div>
          )}

          {/* 상단 정보바 */}
          <div className="w-full max-w-4xl flex justify-between items-center bg-white p-3 rounded-xl shadow-md mb-4 mt-2">
            <div className={`text-xl font-bold ${playerRole === "p1" ? "text-blue-600 underline decoration-4 underline-offset-8" : "text-gray-400"}`}>
              🔵 P1: {scores.p1}점
            </div>
            <div className="text-center flex flex-col items-center gap-1">
              <div className={`text-2xl font-black ${currentTurn === playerRole ? "text-green-600" : "text-slate-800"}`}>
                {currentTurn === playerRole ? "🔔 내 턴!" : "💤 상대방 턴"}
              </div>
              <div className="text-xs text-gray-500 font-bold">🔥 연속: {comboCount}/3</div>
              {currentTurn === playerRole && cardTimerSec > 0 && !showMyTurnNotice && (
                <div className={`text-3xl font-black tabular-nums transition-colors
                  ${cardTimerSec <= 2 ? "text-red-500 animate-pulse" : "text-blue-500"}`}>
                  {cardTimerSec}
                </div>
              )}
              <button onClick={handleForfeit}
                className="mt-1 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg shadow transition-colors">
                🚪 포기하고 나가기
              </button>
            </div>
            <div className={`text-xl font-bold ${playerRole === "p2" ? "text-red-600 underline decoration-4 underline-offset-8" : "text-gray-400"}`}>
              🔴 P2: {scores.p2}점
            </div>
          </div>

          <div className="mb-1 text-sm font-bold text-slate-500">
            나: <span className={playerRole === "p1" ? "text-blue-600" : "text-red-600"}>
              {playerRole === "p1" ? "🔵 P1" : "🔴 P2"}
            </span> ({nickname})
          </div>

          {/* 카드 그리드 */}
          <div className="grid grid-cols-5 gap-2 sm:gap-3 max-w-3xl w-full mx-auto px-2">
            {cards.map((card) => {
              const isShowing = previewStatus === "showAll" || card.isFlipped || card.matchedBy;
              if (!isShowing) {
                return (
                  <div key={card.id} onClick={() => handleCardClick(card)}
                    className="aspect-[3/4] flex items-center justify-center text-2xl sm:text-3xl bg-slate-300 text-gray-500 rounded-lg shadow-sm cursor-pointer hover:bg-slate-400 transition-colors">
                    ❓
                  </div>
                );
              }
              let cardStyles = "bg-white text-black border-2 border-gray-800";
              if (card.matchedBy === "p1") cardStyles = "bg-blue-200 text-blue-900 border-2 border-blue-500";
              if (card.matchedBy === "p2") cardStyles = "bg-red-200  text-red-900  border-2 border-red-500";
              if (previewStatus === "showAll") cardStyles = "bg-amber-50 text-amber-900 border-2 border-amber-400";
              return (
                <div key={card.id}
                  className={`aspect-[3/4] flex items-center justify-center text-sm sm:text-lg font-bold rounded-lg shadow-md transition-all ${cardStyles}`}>
                  {card.content}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── 8. 결과 ── */}
      {gameStatus === "finished" && (
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center w-full max-w-lg">
          <h2 className="text-4xl font-black mb-6 text-slate-800">게임 종료!</h2>
          {roomData?.forfeitWinner && (
            <div className={`mb-4 p-3 rounded-xl font-bold text-sm
              ${roomData.forfeitWinner === playerRole ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {roomData.forfeitWinner === playerRole
                ? "🏳️ 상대방이 포기하여 승리 처리되었습니다. (+1점)"
                : "🚪 포기로 인해 패배 처리되었습니다. (+0점)"}
            </div>
          )}
          <div className="flex justify-around items-center mb-8 bg-slate-50 p-6 rounded-xl">
            <div className="text-center">
              <div className="text-sm font-bold text-blue-600 mb-1">P1 점수</div>
              <div className="text-4xl font-black">{scores.p1}</div>
            </div>
            <div className="text-3xl font-black text-gray-300">:</div>
            <div className="text-center">
              <div className="text-sm font-bold text-red-600 mb-1">P2 점수</div>
              <div className="text-4xl font-black">{scores.p2}</div>
            </div>
          </div>
          <div className="text-3xl font-bold mb-8">
            {playerRole && scores[playerRole] > scores[playerRole === "p1" ? "p2" : "p1"] &&
              <span className="text-blue-600">🎉 승리! (+3점)</span>}
            {playerRole && scores[playerRole] < scores[playerRole === "p1" ? "p2" : "p1"] &&
              <span className="text-gray-500">패배... ({roomData?.forfeitWinner && roomData.forfeitWinner !== playerRole ? "+0점" : "+1점"})</span>}
            {playerRole && scores[playerRole] === scores[playerRole === "p1" ? "p2" : "p1"] &&
              <span className="text-green-600">🤝 무승부! (+2점)</span>}
          </div>
          <button onClick={leaveRoom}
            className="px-8 py-4 bg-slate-800 text-white text-xl font-bold rounded-xl hover:bg-slate-900 shadow-md">
            로비로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}