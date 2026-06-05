"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, get, set, update, remove, onValue, onDisconnect } from "firebase/database";

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
}

interface UserAccount {
  id: string;
  username: string;
  password: string;
  nickname: string;
  totalScore: number;
}

const CHEMICAL_POOL = [
  { id: "H", symbol: "H", name: "수소" },
  { id: "He", symbol: "He", name: "헬륨" },
  { id: "Li", symbol: "Li", name: "리튬" },
  { id: "Be", symbol: "Be", name: "베릴륨" },
  { id: "B", symbol: "B", name: "붕소" },
  { id: "C", symbol: "C", name: "탄소" },
  { id: "N", symbol: "N", name: "질소" },
  { id: "O", symbol: "O", name: "산소" },
  { id: "F", symbol: "F", name: "플루오린" },
  { id: "Ne", symbol: "Ne", name: "네온" },
  { id: "Na", symbol: "Na", name: "나트륨" },
  { id: "Mg", symbol: "Mg", name: "마그네슘" },
  { id: "Al", symbol: "Al", name: "알루미늄" },
  { id: "Si", symbol: "Si", name: "규소" },
  { id: "P", symbol: "P", name: "인" },
  { id: "S", symbol: "S", name: "황" },
  { id: "Cl", symbol: "Cl", name: "염소" },
  { id: "Ar", symbol: "Ar", name: "아르곤" },
  { id: "K", symbol: "K", name: "칼륨" },
  { id: "Ca", symbol: "Ca", name: "칼슘" },
  { id: "Fe", symbol: "Fe", name: "철" },
  { id: "Mn", symbol: "Mn", name: "망가니즈" },
  { id: "Br", symbol: "Br", name: "브로민" },
  { id: "I", symbol: "I", name: "아이오딘" },
  { id: "Ag", symbol: "Ag", name: "은" },
  { id: "Cu", symbol: "Cu", name: "구리" }
];

const ION_POOL = [
  { id: "ion_H", symbol: "H⁺", name: "수소 이온" },
  { id: "ion_Li", symbol: "Li⁺", name: "리튬 이온" },
  { id: "ion_O", symbol: "O²⁻", name: "산화 이온" },
  { id: "ion_F", symbol: "F⁻", name: "플루오린화 이온" },
  { id: "ion_Na", symbol: "Na⁺", name: "나트륨 이온" },
  { id: "ion_Mg", symbol: "Mg²⁺", name: "마그네슘 이온" },
  { id: "ion_Al", symbol: "Al³⁺", name: "알루미늄 이온" },
  { id: "ion_S", symbol: "S²⁻", name: "황화 이온" },
  { id: "ion_Cl", symbol: "Cl⁻", name: "염화 이온" },
  { id: "ion_K", symbol: "K⁺", name: "칼륨 이온" },
  { id: "ion_Ca", symbol: "Ca²⁺", name: "칼슘 이온" },
  { id: "ion_Br", symbol: "Br⁻", name: "브로민화 이온" },
  { id: "ion_I", symbol: "I⁻", name: "아이오딘화 이온" },
  { id: "ion_NO3", symbol: "NO₃⁻", name: "질산 이온" },
  { id: "ion_MnO4", symbol: "MnO₄⁻", name: "과망가니즈산 이온" },
  { id: "ion_Cu", symbol: "Cu²⁺", name: "구리 이온(2+)" }
];

// 상대방 이탈 후 대기 시간(ms) - 30초
const DISCONNECT_TIMEOUT_MS = 30000;

export default function Home() {
  const [gameStatus, setGameStatus] = useState<"login" | "signup" | "lobby" | "waiting" | "rps" | "playing" | "finished" | "admin">("login");
  const [userId, setUserId] = useState("");
  const [nickname, setNickname] = useState("");
  const [myTotalScore, setMyTotalScore] = useState(0);

  const [useElements, setUseElements] = useState(true);
  const [useIons, setUseIons] = useState(true);

  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formNickname, setFormNickname] = useState("");
  const [authError, setAuthError] = useState("");

  const [studentList, setStudentList] = useState<UserAccount[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [roomId, setRoomId] = useState("");
  const [playerRole, setPlayerRole] = useState<"p1" | "p2" | null>(null);
  const [roomData, setRoomData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [previewStatus, setPreviewStatus] = useState<"none" | "countdown" | "showAll">("none");
  const [countdownText, setCountdownText] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndexes, setFlippedIndexes] = useState<number[]>([]);
  const [currentTurn, setCurrentTurn] = useState<"p1" | "p2">("p1");
  const [comboCount, setComboCount] = useState(0);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [isLocked, setIsLocked] = useState(false);

  // 🔧 추가: 상대방 이탈 감지 관련 상태
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(0);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 🔧 추가: 점수 중복 부여 방지 플래그
  const scoreAppliedRef = useRef(false);

  // 🔧 추가: 재입장 시 암기 타이머 중복 방지 플래그
  const previewStartedRef = useRef(false);

  // 최초 진입 시 세션 자동 로그인 & 중간 재조인
  useEffect(() => {
    const initializeAuthAndGame = async () => {
      const currentUserId = localStorage.getItem("element_game_user_id");
      const savedRoomId = localStorage.getItem("element_game_room_id");

      if (currentUserId) {
        setUserId(currentUserId);

        if (savedRoomId) {
          const roomSnap = await get(ref(db, `rooms/${savedRoomId}`));
          if (roomSnap.exists()) {
            const room = roomSnap.val();
            if ((room.p1 === currentUserId || room.p2 === currentUserId) && room.status !== "finished") {
              setRoomId(savedRoomId);
              setPlayerRole(room.p1 === currentUserId ? "p1" : "p2");
              setGameStatus(room.status);

              // 🔧 수정: 재입장 시 playing 상태면 암기 타이머 재실행 안 함
              if (room.status === "playing") {
                previewStartedRef.current = true;
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

    initializeAuthAndGame();
  }, []);

  // 전체 유저 데이터 리스너
  useEffect(() => {
    if (!userId) return;

    const allUsersRef = ref(db, "users");
    const unsubscribe = onValue(allUsersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const usersList: LeaderboardUser[] = Object.keys(data).map((key) => ({
          id: key,
          nickname: data[key].nickname || "무명 원소",
          totalScore: data[key].totalScore || 0,
        }));
        usersList.sort((a, b) => b.totalScore - a.totalScore);
        setLeaderboard(usersList);
      }
    });

    const myUserRef = ref(db, `users/${userId}`);
    const myUnsubscribe = onValue(myUserRef, (snapshot) => {
      if (snapshot.exists()) {
        setMyTotalScore(snapshot.val().totalScore || 0);
        setNickname(snapshot.val().nickname || "");
      }
    });

    return () => {
      unsubscribe();
      myUnsubscribe();
    };
  }, [userId]);

  // 관리자 화면 학생 목록 리스너
  useEffect(() => {
    if (gameStatus !== "admin") return;
    const allUsersRef = ref(db, "users");
    const unsubscribe = onValue(allUsersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list: UserAccount[] = Object.keys(data).map((key) => ({
          id: key,
          username: data[key].username || key,
          password: data[key].password || "",
          nickname: data[key].nickname || "",
          totalScore: data[key].totalScore || 0,
        }));
        setStudentList(list);
      } else {
        setStudentList([]);
      }
    });
    return () => unsubscribe();
  }, [gameStatus]);

  // 🔧 수정: 10초 암기 타이머 - 재입장 시 중복 실행 방지
  useEffect(() => {
    if (gameStatus === "playing" && !previewStartedRef.current) {
      previewStartedRef.current = true;
      setIsLocked(true);
      setPreviewStatus("countdown");
      setCountdownText("3");
      const t1 = setTimeout(() => setCountdownText("2"), 1000);
      const t2 = setTimeout(() => setCountdownText("1"), 2000);
      const t3 = setTimeout(() => setPreviewStatus("showAll"), 3000);
      const t4 = setTimeout(() => {
        setPreviewStatus("none");
        setIsLocked(false);
      }, 13000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [gameStatus]);

  // 🔧 추가: 게임방 내 상대방 온라인 상태 감지 & 이탈 시 카운트다운
  useEffect(() => {
    if (!roomId || !playerRole || !["rps", "playing"].includes(gameStatus)) return;

    const opponentRole = playerRole === "p1" ? "p2" : "p1";
    const opponentOnlineRef = ref(db, `rooms/${roomId}/${opponentRole}_online`);

    const unsubscribe = onValue(opponentOnlineRef, (snapshot) => {
      const isOnline = snapshot.val();

      if (isOnline === false) {
        // 상대방이 오프라인 표시됨 → 카운트다운 시작
        if (!opponentDisconnected) {
          setOpponentDisconnected(true);
          setDisconnectCountdown(DISCONNECT_TIMEOUT_MS / 1000);

          disconnectIntervalRef.current = setInterval(() => {
            setDisconnectCountdown((prev) => {
              if (prev <= 1) {
                if (disconnectIntervalRef.current) clearInterval(disconnectIntervalRef.current);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          disconnectTimerRef.current = setTimeout(() => {
            // 시간 초과 → 내가 승리 처리 (상대방 0점, 내가 10점으로 강제 설정)
            const myRole = playerRole;
            const opRole = opponentRole;
            const forceScores = { [myRole]: 10, [opRole]: 0 };
            update(ref(db, `rooms/${roomId}`), {
              scores: forceScores,
              status: "finished",
              forfeitWinner: myRole,
            });
          }, DISCONNECT_TIMEOUT_MS);
        }
      } else {
        // 상대방이 다시 접속함 → 카운트다운 취소
        if (opponentDisconnected) {
          setOpponentDisconnected(false);
          setDisconnectCountdown(0);
          if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
          if (disconnectIntervalRef.current) clearInterval(disconnectIntervalRef.current);
        }
      }
    });

    return () => {
      unsubscribe();
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
      if (disconnectIntervalRef.current) clearInterval(disconnectIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerRole, gameStatus]);

  // 🔧 추가: 내 온라인 상태를 Firebase에 등록 (이탈 시 자동 false 처리)
  useEffect(() => {
    if (!roomId || !playerRole || !["rps", "playing"].includes(gameStatus)) return;

    const myOnlineRef = ref(db, `rooms/${roomId}/${playerRole}_online`);
    set(myOnlineRef, true);
    onDisconnect(myOnlineRef).set(false);

    return () => {
      // 컴포넌트 언마운트 시(로비로 이동 등 정상 종료)엔 true 유지 → 게임 끝나면 방 자체가 사라지므로 무관
    };
  }, [roomId, playerRole, gameStatus]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!formUsername || !formPassword || !formNickname) {
      setAuthError("모든 칸을 입력해 주세요.");
      return;
    }
    if (formUsername === "admin") {
      setAuthError("사용할 수 없는 아이디입니다.");
      return;
    }
    const userRef = ref(db, `users/${formUsername}`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      setAuthError("이미 존재하는 아이디입니다.");
      return;
    }
    await set(userRef, {
      username: formUsername,
      password: formPassword,
      nickname: formNickname,
      totalScore: 0
    });
    alert("회원가입이 완료되었습니다! 로그인해 주세요.");
    setGameStatus("login");
    setFormNickname("");
    setFormPassword("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (formUsername === "admin" && formPassword === "teacherpw") {
      setGameStatus("admin");
      setFormUsername("");
      setFormPassword("");
      return;
    }
    const userRef = ref(db, `users/${formUsername}`);
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
      setAuthError("존재하지 않는 아이디입니다.");
      return;
    }
    const userData = snapshot.val();
    if (userData.password !== formPassword) {
      setAuthError("비밀번호가 일치하지 않습니다.");
      return;
    }

    localStorage.setItem("element_game_user_id", formUsername);
    setUserId(formUsername);
    setNickname(userData.nickname);
    setMyTotalScore(userData.totalScore || 0);
    setGameStatus("lobby");
    setFormUsername("");
    setFormPassword("");
  };

  const saveStudentEdit = async (id: string) => {
    if (!editNickname || !editPassword) {
      alert("공백으로 수정할 수 없습니다.");
      return;
    }
    await update(ref(db, `users/${id}`), {
      nickname: editNickname,
      password: editPassword
    });
    setEditingId(null);
  };

  const deleteStudent = async (id: string) => {
    if (confirm(`정말로 이 학생(${id}) 계정을 삭제하시겠습니까?\n누적 점수도 함께 사라집니다.`)) {
      await remove(ref(db, `users/${id}`));
    }
  };

  const joinGame = async () => {
    if (!useElements && !useIons) {
      alert("원소기호와 이온 중 최소 하나는 선택해야 합니다.");
      return;
    }
    setGameStatus("waiting");
    const roomsRef = ref(db, "rooms");
    const snapshot = await get(roomsRef);
    let joined = false;

    if (snapshot.exists()) {
      const rooms = snapshot.val();
      for (const key in rooms) {
        if (
          rooms[key].status === "waiting" &&
          rooms[key].mode?.elements === useElements &&
          rooms[key].mode?.ions === useIons
        ) {
          let selectedPairs: any[] = [];

          if (useElements && !useIons) {
            selectedPairs = [...CHEMICAL_POOL].sort(() => Math.random() - 0.5).slice(0, 10);
          } else if (!useElements && useIons) {
            selectedPairs = [...ION_POOL].sort(() => Math.random() - 0.5).slice(0, 10);
          } else {
            selectedPairs = [
              ...[...CHEMICAL_POOL].sort(() => Math.random() - 0.5).slice(0, 5),
              ...[...ION_POOL].sort(() => Math.random() - 0.5).slice(0, 5),
            ];
          }

          const rawData: any[] = [];
          selectedPairs.forEach((elem) => {
            rawData.push({ pairId: elem.id, content: elem.symbol, isFlipped: false, matchedBy: null });
            rawData.push({ pairId: elem.id, content: elem.name, isFlipped: false, matchedBy: null });
          });
          rawData.sort(() => Math.random() - 0.5);
          const shuffledBoard = rawData.map((card, idx) => ({ ...card, id: idx }));

          await update(ref(db, `rooms/${key}`), {
            p2: userId,
            status: "rps",
            board: shuffledBoard,
            scores: { p1: 0, p2: 0 },
            comboCount: 0,
            p1_rps: null,
            p2_rps: null,
            p1_online: true,
            p2_online: true,
          });

          localStorage.setItem("element_game_room_id", key);
          setRoomId(key);
          setPlayerRole("p2");
          joined = true;
          break;
        }
      }
    }

    if (!joined) {
      const newRoomId = `room_${Date.now()}`;
      const newRoomRef = ref(db, `rooms/${newRoomId}`);
      await set(newRoomRef, {
        p1: userId,
        status: "waiting",
        mode: { elements: useElements, ions: useIons },
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
      setRoomId("");
      setPlayerRole(null);
      setGameStatus("lobby");
    } catch (e) {
      console.error(e);
    } finally {
      setIsLocked(false);
    }
  };

  // 방 데이터 실시간 리스너
  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomData(data);
        if (data.status) setGameStatus(data.status);
        if (data.board) setCards(data.board);
        if (data.currentTurn) setCurrentTurn(data.currentTurn);
        if (data.scores) setScores(data.scores);
        if (data.comboCount !== undefined) setComboCount(data.comboCount);

        if (playerRole === "p1" && data.status !== "waiting") {
          onDisconnect(roomRef).cancel();
        }
      }
    });
    return () => unsubscribe();
  }, [roomId, playerRole]);

  // 가위바위보 결과 처리 (p1만 실행)
  useEffect(() => {
    if (gameStatus === "rps" && playerRole === "p1" && roomData?.p1_rps && roomData?.p2_rps) {
      const p1 = roomData.p1_rps;
      const p2 = roomData.p2_rps;
      const timer = setTimeout(() => {
        if (p1 === p2) {
          update(ref(db, `rooms/${roomId}`), { p1_rps: null, p2_rps: null });
        } else {
          const p1Wins =
            (p1 === "rock" && p2 === "scissors") ||
            (p1 === "scissors" && p2 === "paper") ||
            (p1 === "paper" && p2 === "rock");
          update(ref(db, `rooms/${roomId}`), {
            status: "playing",
            currentTurn: p1Wins ? "p1" : "p2",
          });
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gameStatus, playerRole, roomData?.p1_rps, roomData?.p2_rps, roomId]);

  // 모든 카드 매칭 완료 시 게임 종료 (p1만 처리)
  useEffect(() => {
    if (gameStatus === "playing" && scores.p1 + scores.p2 === 10) {
      if (playerRole === "p1") {
        update(ref(db, `rooms/${roomId}`), { status: "finished" });
      }
    }
  }, [scores, gameStatus, playerRole, roomId]);

  // 🔧 수정: 점수 중복 부여 방지 - ref로 한 번만 실행
  useEffect(() => {
    if (gameStatus === "finished" && playerRole && !scoreAppliedRef.current) {
      scoreAppliedRef.current = true;

      const myScore = scores[playerRole];
      const opScore = scores[playerRole === "p1" ? "p2" : "p1"];
      let earnedPoints = 0;

      if (myScore > opScore) earnedPoints = 3;
      else if (myScore === opScore) earnedPoints = 2;
      else earnedPoints = 1;

      get(ref(db, `users/${userId}/totalScore`)).then((snap) => {
        const currentScore = snap.val() || 0;
        update(ref(db, `users/${userId}`), { totalScore: currentScore + earnedPoints });
      });
    }
  }, [gameStatus, playerRole, scores, userId]);

  const handleRpsSelect = (choice: string) => {
    update(ref(db, `rooms/${roomId}`), { [`${playerRole}_rps`]: choice });
  };

  const handleCardClick = (clickedCard: Card) => {
    if (currentTurn !== playerRole || previewStatus !== "none") return;
    if (isLocked || clickedCard.isFlipped || clickedCard.matchedBy) return;

    const newFlipped = [...flippedIndexes, clickedCard.id];
    setFlippedIndexes(newFlipped);
    update(ref(db, `rooms/${roomId}/board/${clickedCard.id}`), { isFlipped: true });

    if (newFlipped.length === 2) {
      setIsLocked(true);
      const [idx1, idx2] = newFlipped;
      const card1 = cards[idx1];
      const card2 = cards[idx2];

      if (card1.pairId === card2.pairId) {
        setTimeout(() => {
          const newCombo = comboCount + 1;
          const nextTurn = newCombo >= 3 ? (currentTurn === "p1" ? "p2" : "p1") : currentTurn;
          const nextCombo = newCombo >= 3 ? 0 : newCombo;
          const newScores = { ...scores, [currentTurn]: scores[currentTurn] + 1 };

          update(ref(db, `rooms/${roomId}`), {
            [`board/${idx1}/matchedBy`]: currentTurn,
            [`board/${idx2}/matchedBy`]: currentTurn,
            scores: newScores,
            currentTurn: nextTurn,
            comboCount: nextCombo,
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
            comboCount: 0,
          });
          setFlippedIndexes([]);
          setIsLocked(false);
        }, 1000);
      }
    }
  };

  const getEmoji = (choice: string) => {
    if (choice === "rock") return "✊";
    if (choice === "paper") return "🖐️";
    if (choice === "scissors") return "✌️";
    return "🤔";
  };

  const handleLogout = () => {
    localStorage.removeItem("element_game_user_id");
    localStorage.removeItem("element_game_room_id");
    setUserId("");
    setNickname("");
    setMyTotalScore(0);
    setGameStatus("login");
  };

  const leaveRoom = () => {
    // 🔧 수정: 방 떠날 때 모든 ref 초기화
    scoreAppliedRef.current = false;
    previewStartedRef.current = false;
    if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
    if (disconnectIntervalRef.current) clearInterval(disconnectIntervalRef.current);

    localStorage.removeItem("element_game_room_id");
    setGameStatus("lobby");
    setRoomId("");
    setPlayerRole(null);
    setRoomData(null);
    setCards([]);
    setScores({ p1: 0, p2: 0 });
    setComboCount(0);
    setCurrentTurn("p1");
    setPreviewStatus("none");
    setOpponentDisconnected(false);
    setDisconnectCountdown(0);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4 select-none">

      {/* 1️⃣ 로그인 화면 */}
      {gameStatus === "login" && (
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-8 border-blue-600">
          <h2 className="text-3xl font-black text-center mb-2 text-slate-800">🧪 원소 대전 로그인</h2>
          <p className="text-sm text-center text-gray-400 mb-6">자신의 기록을 유지하고 대결에 참여하세요!</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">아이디</label>
              <input type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} className="w-full px-4 py-2 border rounded-xl focus:outline-blue-500 text-black" placeholder="아이디 입력" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">비밀번호</label>
              <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full px-4 py-2 border rounded-xl focus:outline-blue-500 text-black" placeholder="비밀번호 입력" />
            </div>
            {authError && <p className="text-xs font-bold text-red-500">{authError}</p>}
            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors">로그인</button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => { setGameStatus("signup"); setAuthError(""); }} className="text-sm font-semibold text-blue-500 hover:underline">계정이 없으신가요? 회원가입</button>
          </div>
        </div>
      )}

      {/* 2️⃣ 회원가입 화면 */}
      {gameStatus === "signup" && (
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-8 border-green-600">
          <h2 className="text-3xl font-black text-center mb-2 text-slate-800">회원가입</h2>
          <p className="text-sm text-center text-gray-400 mb-6">새로운 연구원 정보를 등록합니다.</p>
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">아이디</label>
              <input type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} className="w-full px-4 py-2 border rounded-xl focus:outline-green-500 text-black" placeholder="사용할 아이디" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">비밀번호</label>
              <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full px-4 py-2 border rounded-xl focus:outline-green-500 text-black" placeholder="사용할 비밀번호" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">닉네임</label>
              <input type="text" value={formNickname} onChange={(e) => setFormNickname(e.target.value)} className="w-full px-4 py-2 border rounded-xl focus:outline-green-500 text-black" placeholder="학급 명렬 이름 또는 별명" />
            </div>
            {authError && <p className="text-xs font-bold text-red-500">{authError}</p>}
            <button type="submit" className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md transition-colors">가입하기</button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => { setGameStatus("login"); setAuthError(""); }} className="text-sm font-semibold text-green-500 hover:underline">이미 계정이 있습니다 로그인</button>
          </div>
        </div>
      )}

      {/* 3️⃣ 교사 전용 관리 화면 */}
      {gameStatus === "admin" && (
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl border-t-8 border-purple-600">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-3xl font-black text-slate-800">👨‍🏫 학생 계정 종합 관리실</h2>
              <p className="text-sm text-gray-400">학생 정보의 실시간 확인, 수정 및 삭제가 가능합니다.</p>
            </div>
            <button onClick={() => setGameStatus("login")} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-xl shadow-sm text-sm">관리자 로그아웃</button>
          </div>
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-left border-collapse text-black text-sm">
              <thead>
                <tr className="bg-slate-100 font-bold border-b text-slate-700">
                  <th className="p-3">아이디</th>
                  <th className="p-3">비밀번호</th>
                  <th className="p-3">닉네임</th>
                  <th className="p-3">누적 승점</th>
                  <th className="p-3 text-center">관리 액션</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {studentList.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-gray-600">{student.username}</td>
                    <td className="p-3">
                      {editingId === student.id ? (
                        <input type="text" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="border px-2 py-1 rounded w-32 focus:outline-purple-500" />
                      ) : (
                        <span className="font-mono text-gray-500">{student.password}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {editingId === student.id ? (
                        <input type="text" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} className="border px-2 py-1 rounded w-32 focus:outline-purple-500" />
                      ) : (
                        <span className="font-bold text-slate-700">{student.nickname}</span>
                      )}
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
                          <button onClick={() => { setEditingId(student.id); setEditNickname(student.nickname); setEditPassword(student.password); }} className="px-3 py-1 bg-amber-500 text-white font-bold rounded text-xs hover:bg-amber-600">수정</button>
                          <button onClick={() => deleteStudent(student.id)} className="px-3 py-1 bg-red-500 text-white font-bold rounded text-xs hover:bg-red-600">삭제</button>
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

      {/* 4️⃣ 로비 화면 */}
      {gameStatus === "lobby" && (
        <div className="flex flex-col md:flex-row gap-6 w-full max-w-4xl">
          <div className="flex-1 bg-white p-8 rounded-2xl shadow-xl text-center border-t-8 border-blue-500 flex flex-col justify-between">
            <div className="text-right">
              <button onClick={handleLogout} className="text-xs font-bold text-gray-400 hover:text-red-500 hover:underline">로그아웃</button>
            </div>
            <div className="mt-2">
              <h1 className="text-4xl font-black mb-2 text-slate-800">🧪 원소 기호 대전</h1>
              <p className="text-gray-400 mb-6">연구원 정보: <span className="text-slate-700 font-bold">{nickname} ({userId})</span></p>

              <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-gray-200 text-black text-left">
                <div className="text-xs font-bold text-gray-400 mb-2">게임 출제 범위 설정</div>
                <div className="flex gap-6 justify-center py-2">
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-lg">
                    <input type="checkbox" checked={useElements} onChange={(e) => setUseElements(e.target.checked)} className="w-5 h-5 accent-blue-600" />
                    원소기호 (1~20번+필수6종)
                  </label>
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-lg">
                    <input type="checkbox" checked={useIons} onChange={(e) => setUseIons(e.target.checked)} className="w-5 h-5 accent-blue-600" />
                    이온세트 (필수16종)
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl mb-6">
                <div className="text-sm text-blue-500 font-bold mb-1">내 누적 승점</div>
                <div className="text-4xl font-black text-blue-600">{myTotalScore}점</div>
              </div>
            </div>
            <button onClick={joinGame} className="w-full py-5 bg-blue-600 text-white text-2xl font-bold rounded-xl hover:bg-blue-700 shadow-md transition-all">
              게임 참가하기 ⚔️
            </button>
          </div>

          <div className="w-full md:w-80 bg-white p-6 rounded-2xl shadow-xl flex flex-col border-t-8 border-amber-500">
            <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">🏆 우수 연구원 랭킹</h2>
            <div className="overflow-y-auto max-h-64 flex-1 space-y-2 pr-1">
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
            </div>
          </div>
        </div>
      )}

      {/* 5️⃣ 대기 화면 */}
      {gameStatus === "waiting" && (
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center animate-pulse max-w-md w-full">
          <div className="text-6xl mb-4">👀</div>
          <h2 className="text-2xl font-bold text-slate-700 mb-4">동일 모드의 상대방을 매칭 중입니다...</h2>
          <button
            onClick={cancelMatching}
            className="mt-6 px-6 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-sm transition-colors text-sm"
          >
            매칭 취소하고 로비로 돌아가기
          </button>
        </div>
      )}

      {/* 6️⃣ 가위바위보 화면 */}
      {gameStatus === "rps" && (
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center w-full max-w-2xl">
          {/* 🔧 추가: 상대방 이탈 알림 배너 */}
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
            <div className="flex justify-center gap-4">
              <button onClick={() => handleRpsSelect("scissors")} className="text-5xl hover:scale-110 bg-gray-100 p-4 rounded-xl">✌️</button>
              <button onClick={() => handleRpsSelect("rock")} className="text-5xl hover:scale-110 bg-gray-100 p-4 rounded-xl">✊</button>
              <button onClick={() => handleRpsSelect("paper")} className="text-5xl hover:scale-110 bg-gray-100 p-4 rounded-xl">🖐️</button>
            </div>
          )}
        </div>
      )}

      {/* 7️⃣ 본 게임 화면 */}
      {gameStatus === "playing" && (
        <>
          {previewStatus === "countdown" && (
            <div className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-center text-white">
              <div className="text-8xl font-black mb-4 tracking-wider text-amber-400 animate-ping">
                {countdownText}
              </div>
              <p className="text-xl font-bold">잠시 후 게임판이 전체 공개됩니다!</p>
            </div>
          )}

          {previewStatus === "showAll" && (
            <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center py-3 font-black text-xl z-50 shadow-md animate-pulse">
              ⚡ 👀 10초 동안 카드를 잘 기억하세요! ⚡
            </div>
          )}

          {/* 🔧 추가: 게임 중 상대방 이탈 알림 */}
          {opponentDisconnected && (
            <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-3 font-black text-lg z-50 shadow-md">
              ⚠️ 상대방 연결 끊김! {disconnectCountdown}초 안에 돌아오지 않으면 자동 승리 처리됩니다.
            </div>
          )}

          <div className="mb-2 text-lg font-bold text-slate-600 mt-12">
            당신은 <span className={playerRole === "p1" ? "text-blue-600" : "text-red-600"}>
              {playerRole === "p1" ? "🔵 플레이어 1" : "🔴 플레이어 2"}
            </span> ({nickname}) 입니다.
          </div>
          <div className="w-full max-w-4xl flex justify-between items-center bg-white p-4 rounded-xl shadow-md mb-6">
            <div className={`text-xl font-bold ${playerRole === "p1" ? "text-blue-600 underline decoration-4 underline-offset-8" : "text-gray-400"}`}>
              🔵 P1: {scores.p1}점
            </div>
            <div className="text-center">
              <div className={`text-2xl font-black ${currentTurn === playerRole ? "text-green-600" : "text-slate-800"}`}>
                {currentTurn === playerRole ? "🔔 내 턴입니다!" : "💤 상대방 턴입니다"}
              </div>
              <div className="text-sm text-gray-500 font-bold mt-1">🔥 연속 정답: {comboCount} / 3</div>
            </div>
            <div className={`text-xl font-bold ${playerRole === "p2" ? "text-red-600 underline decoration-4 underline-offset-8" : "text-gray-400"}`}>
              🔴 P2: {scores.p2}점
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 sm:gap-3 max-w-3xl w-full mx-auto px-2">
            {cards.map((card) => {
              const isShowing = previewStatus === "showAll" || card.isFlipped || card.matchedBy;

              if (!isShowing) {
                return (
                  <div
                    key={card.id}
                    onClick={() => handleCardClick(card)}
                    className="aspect-[3/4] flex items-center justify-center text-2xl sm:text-3xl bg-slate-300 text-gray-500 rounded-lg shadow-sm cursor-pointer hover:bg-slate-400 transition-colors"
                  >
                    ❓
                  </div>
                );
              }

              let cardStyles = "bg-white text-black border-2 border-gray-800";
              if (card.matchedBy === "p1") cardStyles = "bg-blue-200 text-blue-900 border-2 border-blue-500";
              if (card.matchedBy === "p2") cardStyles = "bg-red-200 text-red-900 border-2 border-red-500";
              if (previewStatus === "showAll") cardStyles = "bg-amber-50 text-amber-900 border-2 border-amber-400";

              return (
                <div
                  key={card.id}
                  className={`aspect-[3/4] flex items-center justify-center text-sm sm:text-lg font-bold rounded-lg shadow-md transition-all ${cardStyles}`}
                >
                  {card.content}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 8️⃣ 결과 화면 */}
      {gameStatus === "finished" && (
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center w-full max-w-lg">
          <h2 className="text-4xl font-black mb-6 text-slate-800">게임 종료!</h2>
          {/* 🔧 추가: 몰수패 안내 */}
          {roomData?.forfeitWinner && (
            <div className={`mb-4 p-3 rounded-xl font-bold text-sm ${roomData.forfeitWinner === playerRole ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {roomData.forfeitWinner === playerRole ? "🏳️ 상대방 연결 끊김으로 자동 승리 처리되었습니다." : "🔌 연결이 끊겨 몰수패 처리되었습니다."}
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
            {playerRole && scores[playerRole] > scores[playerRole === "p1" ? "p2" : "p1"] && <span className="text-blue-600">🎉 승리! (+3점)</span>}
            {playerRole && scores[playerRole] < scores[playerRole === "p1" ? "p2" : "p1"] && <span className="text-gray-500">패배... (+1점)</span>}
            {playerRole && scores[playerRole] === scores[playerRole === "p1" ? "p2" : "p1"] && <span className="text-green-600">🤝 무승부! (+2점)</span>}
          </div>
          <button onClick={leaveRoom} className="px-8 py-4 bg-slate-800 text-white text-xl font-bold rounded-xl hover:bg-slate-900 shadow-md">
            로비로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}
