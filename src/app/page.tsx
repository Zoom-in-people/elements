"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { ref, get, set, update, onValue } from "firebase/database";

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

// 💡 [데이터 주입] 원소기호 1~20번 + 요청하신 필수 원소 6종 (총 26종 마스터 데이터 풀)
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
  const [userId, setUserId] = useState("");
  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("");
  const [playerRole, setPlayerRole] = useState<"p1" | "p2" | null>(null);
  const [gameStatus, setGameStatus] = useState<"lobby" | "waiting" | "rps" | "playing" | "finished">("lobby");
  const [roomData, setRoomData] = useState<any>(null);

  const [myTotalScore, setMyTotalScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [previewStatus, setPreviewStatus] = useState<"none" | "countdown" | "showAll">("none");
  const [countdownText, setCountdownText] = useState("");

  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndexes, setFlippedIndexes] = useState<number[]>([]);
  const [currentTurn, setCurrentTurn] = useState<"p1" | "p2">("p1");
  const [comboCount, setComboCount] = useState(0);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [isLocked, setIsLocked] = useState(false);

  const generateScientificName = () => {
    const adjectives = ["빛나는", "짜릿한", "춤추는", "불타는", "가벼운", "단단한", "반응하는", "투명한"];
    const nouns = ["수소", "헬륨", "나트륨", "네온", "이온", "분자", "원자", "전자", "칼슘", "칼륨"];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
  };

  useEffect(() => {
    let currentUserId = localStorage.getItem("element_game_user_id");
    if (!currentUserId) {
      currentUserId = Math.random().toString(36).substring(2, 9);
      localStorage.setItem("element_game_user_id", currentUserId);
    }
    setUserId(currentUserId);

    const userRef = ref(db, `users/${currentUserId}`);
    onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setMyTotalScore(data.totalScore || 0);
        setNickname(data.nickname || "");
      } else {
        const newName = generateScientificName();
        set(userRef, { totalScore: 0, nickname: newName });
        setNickname(newName);
      }
    });

    const allUsersRef = ref(db, "users");
    onValue(allUsersRef, (snapshot) => {
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
  }, []);

  // ⏱️ [시간 연출 수정] 3초 카운트다운 후 -> 5초 동안 쾌적하게 전체 보기 제공
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

      // 8000 -> 13000 (3초 대기 + 10초 보여주기)로 변경합니다.
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

  const joinGame = async () => {
    setGameStatus("waiting");
    const roomsRef = ref(db, "rooms");
    const snapshot = await get(roomsRef);
    let joined = false;

    if (snapshot.exists()) {
      const rooms = snapshot.val();
      for (const key in rooms) {
        if (rooms[key].status === "waiting") {
          // 🎲 [무작위 추출] 전체 풀 26종 중 15종을 랜덤 샘플링하여 30장 보드 빌드
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

  useEffect(() => {
    if (gameStatus === "playing" && scores.p1 + scores.p2 === 15) {
      if (playerRole === "p1") {
        update(ref(db, `rooms/${roomId}`), { status: "finished" });
      }
    }
  }, [scores, gameStatus, playerRole, roomId]);

  useEffect(() => {
    if (gameStatus === "finished" && playerRole) {
      const myScore = scores[playerRole];
      const opScore = scores[playerRole === "p1" ? "p2" : "p1"];
      let earnedPoints = 0;
      
      if (myScore > opScore) earnedPoints = 3;
      else if (myScore === opScore) earnedPoints = 1;

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

  const getEmoji = (choice: string) => {
    if (choice === "rock") return "✊";
    if (choice === "paper") return "🖐️";
    if (choice === "scissors") return "✌️";
    return "🤔";
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4 select-none">
      
      {/* 🟢 로비 화면 */}
      {gameStatus === "lobby" && (
        <div className="flex flex-col md:flex-row gap-6 w-full max-w-4xl">
          <div className="flex-1 bg-white p-8 rounded-2xl shadow-xl text-center border-t-8 border-blue-500 flex flex-col justify-between">
            <div>
              <h1 className="text-4xl font-black mb-2 text-slate-800">🧪 원소 기호 대전</h1>
              <p className="text-gray-400 mb-6">당신의 아바타: <span className="text-slate-700 font-bold">{nickname}</span></p>
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
          {/* 🛠️ 3, 2, 1 카운트다운일 때만 불투명하게 화면 전체를 덮습니다 (어차피 가려진 카드라 노출에 지장 없음) */}
          {previewStatus === "countdown" && (
            <div className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-center text-white">
              <div className="text-8xl font-black mb-4 tracking-wider text-amber-400 animate-ping">
                {countdownText}
              </div>
              <p className="text-xl font-bold">잠시 후 게임판이 전체 공개됩니다!</p>
            </div>
          )}

          {/* 🛠️ [UI 위치 개선] 5초간 기억하기 단계에서는 카드 시야를 절대 가리지 않도록 상단에 슬림 배너로 표기합니다. */}
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
          
{/* max-w-4xl을 max-w-3xl로 줄이고 gap을 2로 줄였습니다. */}
          <div className="grid grid-cols-6 gap-2 sm:gap-3 max-w-3xl w-full mx-auto px-2">
            {cards.map((card) => {
              const isShowing = previewStatus === "showAll" || card.isFlipped || card.matchedBy;

              if (!isShowing) {
                return (
                  <div
                    key={card.id}
                    onClick={() => handleCardClick(card)}
                    // 물음표 글자 크기를 4xl에서 2xl(모바일)~3xl(PC) 수준으로 줄였습니다.
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
                  // 원소 기호/이름 텍스트 크기를 반응형(text-sm sm:text-lg)으로 줄였습니다.
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
            {scores[playerRole!] < scores[playerRole === "p1" ? "p2" : "p1"] && <span className="text-gray-500">패배... (0점)</span>}
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