"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { ref, get, set, update, remove, onValue } from "firebase/database";

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

// 학생 관리 및 로그인용 인터페이스
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

export default function Home() {
  // --- [인증 및 시스템 상태] ---
  const [gameStatus, setGameStatus] = useState<"login" | "signup" | "lobby" | "waiting" | "rps" | "playing" | "finished" | "admin">("login");
  const [userId, setUserId] = useState(""); // 로그인한 사용자의 고유 ID (username과 동일하게 처리)
  const [nickname, setNickname] = useState("");
  const [myTotalScore, setMyTotalScore] = useState(0);

  // --- [폼 입력 상태] ---
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formNickname, setFormNickname] = useState("");
  const [authError, setAuthError] = useState("");

  // --- [교사 관리자 상태] ---
  const [studentList, setStudentList] = useState<UserAccount[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editPassword, setEditPassword] = useState("");

  // --- [게임 플레이 상태] ---
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

  // 실시간 리더보드 연동 (로그인 이후부터 상시 가동)
  useEffect(() => {
    if (gameStatus === "login" || gameStatus === "signup" || gameStatus === "admin") return;

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

    // 내 점수 실시간 연동
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
  }, [gameStatus, userId]);

  // 교사 페이지 진입 시 학생 목록 실시간 구독
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

  // 10초 암기 타이머 연출
  useEffect(() => {
    if (gameStatus === "playing") {
      setIsLocked(true); 
      setPreviewStatus("countdown");
      setCountdownText("3");
      const t1 = setTimeout(() => setCountdownText("2"), 1000);
      const t2 = setTimeout(() => setCountdownText("1"), 2000);
      
      const t3 = setTimeout(() => {
        setPreviewStatus("showAll"); 
      }, 3000);

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

  // --- [회원가입 처리] ---
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

  // --- [로그인 처리] ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    // 교사용 계정 예외 처리
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

    // 로그인 성공 시 정보 세팅 후 로비 진입
    setUserId(formUsername);
    setNickname(userData.nickname);
    setMyTotalScore(userData.totalScore || 0);
    setGameStatus("lobby");
    setFormUsername("");
    setFormPassword("");
  };

  // --- [교사 기능: 학생 수정 저장] ---
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

  // --- [교사 기능: 학생 삭제] ---
  const deleteStudent = async (id: string) => {
    if (confirm(`정말로 이 학생(${id}) 계정을 삭제하시겠습니까?\n누적 점수도 함께 사라집니다.`)) {
      await remove(ref(db, `users/${id}`));
    }
  };

  // --- [게임 플레이 방 참가/생성 로직] ---
  const joinGame = async () => {
    setGameStatus("waiting");
    const roomsRef = ref(db, "rooms");
    const snapshot = await get(roomsRef);
    let joined = false;

    if (snapshot.exists()) {
      const rooms = snapshot.val();
      for (const key in rooms) {
        if (rooms[key].status === "waiting") {
          const shuffledPool = [...CHEMICAL_POOL].sort(() => Math.random() - 0.5);
          const selectedElements = shuffledPool.slice(0, 15);
          
          const rawData: any[] = [];
          selectedElements.forEach((elem) => {
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
            p2_rps: null
          });
          setRoomId(key);
          setPlayerRole("p2");
          joined = true;
          break;
        }
      }
    }

    if (!joined) {
      const newRoomId = `room_${Date.now()}`;
      await set(ref(db, `rooms/${newRoomId}`), {
        p1: userId,
        status: "waiting"
      });
      setRoomId(newRoomId);
      setPlayerRole("p1");
    }
  };

  // 실시간 방 데이터 수신
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
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  // 가위바위보 판정
  useEffect(() => {
    if (gameStatus === "rps" && playerRole === "p1" && roomData?.p1_rps && roomData?.p2_rps) {
      const p1 = roomData.p1_rps;
      const p2 = roomData.p2_rps;
      const timer = setTimeout(() => {
        if (p1 === p2) {
          update(ref(db, `rooms/${roomId}`), { p1_rps: null, p2_rps: null });
        } else {
          const p1Wins = (p1 === "rock" && p2 === "scissors") || (p1 === "scissors" && p2 === "paper") || (p1 === "paper" && p2 === "rock");
          update(ref(db, `rooms/${roomId}`), { 
            status: "playing", 
            currentTurn: p1Wins ? "p1" : "p2" 
          });
        }
      }, 2000); 
      return () => clearTimeout(timer);
    }
  }, [gameStatus, playerRole, roomData?.p1_rps, roomData?.p2_rps, roomId]);

  // 판 끝남 판정
  useEffect(() => {
    if (gameStatus === "playing" && scores.p1 + scores.p2 === 15) {
      if (playerRole === "p1") {
        update(ref(db, `rooms/${roomId}`), { status: "finished" });
      }
    }
  }, [scores, gameStatus, playerRole, roomId]);

  // 점수 정산
  useEffect(() => {
    if (gameStatus === "finished" && playerRole) {
      const myScore = scores[playerRole];
      const opScore = scores[playerRole === "p1" ? "p2" : "p1"];
      let earnedPoints = 0;
      
      if (myScore > opScore) earnedPoints = 3;
      else if (myScore === opScore) earnedPoints = 1;
      else earnedPoints = 1; // 🔥 패배 시에도 +1점 부여!

      get(ref(db, `users/${userId}/totalScore`)).then((snap) => {
        const currentScore = snap.val() || 0;
        update(ref(db, `users/${userId}`), { totalScore: currentScore + earnedPoints });
      });
    }
  }, [gameStatus]);

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
            comboCount: nextCombo
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
            comboCount: 0
          });
          setFlippedIndexes([]);
          setIsLocked(false);
        }, 1000);
      }
    }
  };

  const leaveRoom = () => {
    setGameStatus("lobby");
    setRoomId("");
    setPlayerRole(null);
    setRoomData(null);
    setCards([]);
    setScores({ p1: 0, p2: 0 });
    setComboCount(0);
    setCurrentTurn("p1");
    setPreviewStatus("none");
  };
  // 가위바위보 이모지 변환 도우미 (이 부분을 return 위에 추가해 주세요!)
  const getEmoji = (choice: string) => {
    if (choice === "rock") return "✊";
    if (choice === "paper") return "🖐️";
    if (choice === "scissors") return "✌️";
    return "🤔";
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

      {/* 3️⃣ 교사 전용 관리 화면 (admin) */}
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
                {studentList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400 font-bold">등록된 학생 계정이 아직 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🟢 로비 화면 */}
      {gameStatus === "lobby" && (
        <div className="flex flex-col md:flex-row gap-6 w-full max-w-4xl">
          <div className="flex-1 bg-white p-8 rounded-2xl shadow-xl text-center border-t-8 border-blue-500 flex flex-col justify-between">
            <div className="text-right">
              <button onClick={() => setGameStatus("login")} className="text-xs font-bold text-gray-400 hover:text-red-500 hover:underline">로그아웃</button>
            </div>
            <div className="mt-2">
              <h1 className="text-4xl font-black mb-2 text-slate-800">🧪 원소 기호 대전</h1>
              <p className="text-gray-400 mb-6">로그인 계정: <span className="text-slate-700 font-bold">{nickname} ({userId})</span></p>
              <div className="bg-blue-50 p-6 rounded-xl mb-6">
                <div className="text-sm text-blue-500 font-bold mb-1">내 누적 승점</div>
                <div className="text-5xl font-black text-blue-600">{myTotalScore}점</div>
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

      {/* 🟡 대기 화면 */}
      {gameStatus === "waiting" && (
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center animate-pulse">
          <div className="text-6xl mb-4">👀</div>
          <h2 className="text-2xl font-bold text-slate-700 mb-4">상대방을 기다리는 중입니다...</h2>
        </div>
      )}

      {/* 🟠 가위바위보 화면 */}
      {gameStatus === "rps" && (
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center w-full max-w-2xl">
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
                  : (roomData?.[playerRole === "p1" ? "p2_rps" : "p1_rps"] ? "✔️" : "⏳")}
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

      {/* 🔴 본 게임 화면 */}
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
          
          <div className="grid grid-cols-6 gap-2 sm:gap-3 max-w-3xl w-full mx-auto px-2">
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

      {/* 🏁 결과 화면 */}
      {gameStatus === "finished" && (
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center w-full max-w-lg">
          <h2 className="text-4xl font-black mb-6 text-slate-800">게임 종료!</h2>
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
            {scores[playerRole!] > scores[playerRole === "p1" ? "p2" : "p1"] && <span className="text-blue-600">🎉 승리! (+3점)</span>}
            {scores[playerRole!] < scores[playerRole === "p1" ? "p2" : "p1"] && <span className="text-gray-500">패배... (+1점)</span>}
            {scores[playerRole!] === scores[playerRole === "p1" ? "p2" : "p1"] && <span className="text-green-600">🤝 무승부! (+1점)</span>}
          </div>
          <button onClick={leaveRoom} className="px-8 py-4 bg-slate-800 text-white text-xl font-bold rounded-xl hover:bg-slate-900 shadow-md">
            로비로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}