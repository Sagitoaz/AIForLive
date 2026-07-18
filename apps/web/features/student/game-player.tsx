"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Asset } from "@/components/asset";
import { StatusPill } from "@/components/ui";
import { games } from "@/lib/demo-data";

export function GamePlayer({ slug }: { slug: string }) {
  const game = games.find((item) => item.slug === slug) ?? games[0];
  return (
    <div className="game-player-page">
      <header className="game-header"><Link href="/student/games">← Phòng luyện kỹ năng</Link><div><StatusPill tone="purple">Thực hành có tương tác</StatusPill><h1>{game?.title}</h1></div><span>PYTHON_RANGE · 5–8 phút</span></header>
      {slug === "code-order" && <CodeOrder />}
      {slug === "predict-output" && <PredictOutput />}
      {slug === "bug-hunter" && <BugHunter />}
      {slug === "range-runner" && <RangeRunner />}
      {!games.some((item) => item.slug === slug) && <CodeOrder />}
    </div>
  );
}

function SortableLine({ id, code, index }: { id: string; code: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <button ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`sortable-line ${isDragging ? "dragging" : ""}`} {...attributes} {...listeners}><span>⠿</span><em>{index + 1}</em><code>{code}</code></button>;
}

function Celebration({ title, detail }: { title: string; detail: string }) {
  return <div className="game-celebration learning-complete"><Asset type="mascot" name="mam-celebrate" alt="Mầm xác nhận hoàn thành" width={190} height={180}/><span className="eyebrow">Hoạt động đã hoàn thành</span><h2>{title}</h2><p>{detail}</p><div><Link href="/student/games" className="button ghost">Chọn hoạt động khác</Link><Link href="/student/lesson" className="button primary">Về bài học →</Link></div></div>;
}

function CodeOrder() {
  const lineMap: Record<string, string> = { print: "    print(number)", loop: "for number in range(1, 5):", title: "numbers = []", append: "    numbers.append(number)" };
  const correct = ["title", "loop", "append", "print"];
  const [items, setItems] = useState(["loop", "print", "title", "append"]);
  const [result, setResult] = useState<"idle" | "right" | "wrong">("idle");
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const end = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setItems((current) => arrayMove(current, current.indexOf(String(active.id)), current.indexOf(String(over.id))));
    setResult("idle");
  };
  if (result === "right") return <Celebration title="Code chạy đúng thứ tự" detail="Kết quả này là một evidence cho kỹ năng đọc cấu trúc vòng lặp."/>;
  return <section className="game-stage code-order"><div className="game-instruction"><Asset type="game" name="game-asset-01" alt="Các khối code" width={340} height={230}/><span className="eyebrow">Kéo hoặc dùng bàn phím</span><h2>Sắp xếp để lưu và in từng số</h2><p>Dòng trong vòng lặp phải thụt lề sau dòng for.</p></div><div className="game-board"><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}><SortableContext items={items} strategy={verticalListSortingStrategy}>{items.map((id, index) => <SortableLine id={id} code={lineMap[id] ?? ""} index={index} key={id}/>)}</SortableContext></DndContext>{result === "wrong" && <p className="game-error">Thứ tự chưa đúng. Hãy tạo list trước vòng lặp.</p>}<button className="button primary full" onClick={() => setResult(JSON.stringify(items) === JSON.stringify(correct) ? "right" : "wrong")}>Chạy thử code</button></div></section>;
}

function PredictOutput() {
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  if (done && selected === 1) return <Celebration title="Dự đoán chính xác!" detail="Vòng lặp chạy ba lần: 0, 2 và 4."/>;
  return <section className="game-stage"><div className="game-instruction"><Asset type="game" name="game-asset-02" alt="Màn hình output" width={340} height={230}/><span className="eyebrow">Predict Output</span><h2>Đọc code trước khi chạy</h2><pre><code>{"for n in range(0, 6, 2):\n    print(n)"}</code></pre></div><div className="game-board"><h3>Output nào xuất hiện?</h3><div className="answer-list">{["0, 1, 2, 3, 4, 5", "0, 2, 4", "0, 2, 4, 6"].map((answer, index) => <button className={selected === index ? "selected" : ""} onClick={() => { setSelected(index); setDone(false); }} key={answer}><span>{String.fromCharCode(65 + index)}</span><code>{answer}</code></button>)}</div>{done && selected !== 1 && <p className="game-error">Stop là 6 nên dãy dừng trước 6.</p>}<button className="button primary full" disabled={selected === null} onClick={() => setDone(true)}>Khóa dự đoán</button></div></section>;
}

function BugHunter() {
  const lines = ["count = 1", "while count <= 3:", "    print(count)", "    count = count"];
  const [selected, setSelected] = useState<number | null>(null);
  const [fixed, setFixed] = useState(false);
  if (fixed) return <Celebration title="Đã bắt được infinite loop!" detail="Sửa thành count = count + 1 để vòng lặp tiến tới điểm dừng."/>;
  return <section className="game-stage"><div className="game-instruction"><Asset type="game" name="game-asset-03" alt="Kính lúp bắt bug" width={340} height={230}/><span className="eyebrow">Bug Hunter</span><h2>Vì sao chương trình không dừng?</h2><p>Chọn đúng dòng giữ cho biến điều kiện không đổi.</p></div><div className="game-board bug-board">{lines.map((line, index) => <button className={selected === index ? "selected" : ""} onClick={() => setSelected(index)} key={line}><span>{index + 1}</span><code>{line}</code></button>)}{selected !== null && selected !== 3 && <p className="game-error">Dòng này hợp lệ. Hãy xem biến count có thay đổi không.</p>}{selected === 3 && <div className="bug-fix"><strong>WHILE_VARIABLE_NOT_UPDATED</strong><code>count = count + 1</code><p>Evidence: giá trị trước và sau dòng 4 đều bằng nhau.</p></div>}<button className="button primary full" disabled={selected !== 3} onClick={() => setFixed(true)}>Áp dụng bản sửa</button></div></section>;
}

function RangeRunner() {
  const tiles = useMemo(() => [1, 2, 3, 4, 5, 6], []);
  const [position, setPosition] = useState(1);
  const [message, setMessage] = useState("Mục tiêu: range(1, 5)");
  const [won, setWon] = useState(false);
  const move = () => {
    if (position >= 4) {
      setWon(true);
      setMessage("Đúng! Dừng ở 4, ngay trước stop 5.");
      return;
    }
    setPosition((value) => value + 1);
    setMessage("Mầm tiến thêm một bước.");
  };
  if (won) return <Celebration title="Dừng đúng trước stop!" detail="range(1, 5) ghé 1, 2, 3, 4 và không ghé ô 5."/>;
  return <section className="game-stage range-game"><div className="game-instruction"><Asset type="game" name="game-asset-04" alt="Đường chạy range" width={340} height={230}/><span className="eyebrow">Range Runner</span><h2>Đưa Mầm qua range(1, 5)</h2><p>Nhấn tiến cho tới phần tử cuối cùng được phép.</p></div><div className="runner-board"><div className="runner-track">{tiles.map((tile) => <div className={tile === 5 ? "tile stop" : tile === position ? "tile active" : "tile"} key={tile}><span>{tile}</span>{tile === 5 && <small>STOP</small>}{tile === position && <Asset type="mascot" name="mam-code" alt="Mầm" width={82} height={76}/>}</div>)}</div><p>{message}</p><div className="runner-controls"><button className="button ghost" disabled={position <= 1} onClick={() => setPosition((value) => value - 1)}>← Lùi</button><button className="button primary" onClick={move}>{position >= 4 ? "Dừng tại đây" : "Tiến một ô →"}</button></div></div></section>;
}
