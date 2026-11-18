"""把 data/ 下的题目 JSON 合并成 js/questions.js。

用法：python3 scripts/build.py
- data/m0.json ~ data/m9.json：按模块出的题，set 字段为 1-10
- data/official.json：官方模拟考试 15 题，set 为 "official"
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

MODULES = [
    ["概览与方法论", 11.5], ["腾讯云 AI 体系矩阵", 8.5], ["人工智能工程", 10],
    ["WorkBuddy 上手实操", 10], ["企业后台与 WMA 配置实战", 10], ["进场-挖真需求", 10],
    ["交付-做成且验得动", 10], ["沉淀-把经验变成组织资产", 10.5], ["FDE 养成计划", 10],
    ["安全治理与护栏", 9.5],
]


def main():
    bank, errors = [], []
    for m in range(10):
        f = DATA / f"m{m}.json"
        if not f.exists():
            errors.append(f"缺少 {f.name}")
            continue
        for q in json.loads(f.read_text(encoding="utf-8")):
            q["m"] = m
            bank.append(q)
    off = DATA / "official.json"
    if off.exists():
        bank.extend(json.loads(off.read_text(encoding="utf-8")))

    for i, q in enumerate(bank):
        tag = f"set={q.get('set')} m={q.get('m')} #{i}"
        for key in ("set", "t", "k", "q", "o", "a", "e", "src"):
            if key not in q:
                errors.append(f"{tag} 缺字段 {key}")
        if any(x >= len(q.get("o", [])) for x in q.get("a", [])):
            errors.append(f"{tag} 答案下标越界")
        if q.get("t") == "s" and len(q.get("a", [])) != 1:
            errors.append(f"{tag} 单选题答案数不为 1")
        if q.get("t") == "m" and len(q.get("a", [])) < 2:
            errors.append(f"{tag} 多选题答案少于 2 个")
        x = q.get("x")
        if x is None or not q.get("c"):
            errors.append(f"{tag} 缺少逐项解析 x 或知识点讲解 c")
        elif len(x) != len(q.get("o", [])):
            errors.append(f"{tag} 逐项解析 x 的条数与选项数不一致")
        else:
            for i, t in enumerate(x):
                want = "正确" if i in q.get("a", []) else "错误"
                if not str(t).startswith(want):
                    errors.append(f"{tag} 第 {i + 1} 项解析应以「{want}」开头")
                    break

    sets = sorted({q["set"] for q in bank if q["set"] != "official"})
    set_list = [{"id": s, "name": f"第 {s} 套"} for s in sets]
    if off.exists():
        set_list.append({"id": "official", "name": "官方模拟题"})

    out = (
        "// 由 scripts/build.py 根据 data/*.json 生成，请勿手改。\n"
        "// 字段：set 试卷，m 模块，t 题型(s 单选 / m 多选)，k 考点，q 题干，o 选项，a 正确选项下标，e 解析，src 出处\n"
        f"window.MODULES = {json.dumps(MODULES, ensure_ascii=False)};\n"
        f"window.SET_LIST = {json.dumps(set_list, ensure_ascii=False)};\n"
        f"window.BANK = {json.dumps(bank, ensure_ascii=False, indent=0)};\n"
    )
    (ROOT / "js" / "questions.js").write_text(out, encoding="utf-8")

    # 术语卡片：data/glossary/g0.json ~ g9.json → js/glossary.js
    gloss = []
    for m in range(10):
        f = DATA / "glossary" / f"g{m}.json"
        if not f.exists():
            continue
        for rank, g in enumerate(json.loads(f.read_text(encoding="utf-8"))):
            for key in ("term", "plain", "points", "src"):
                if not g.get(key):
                    errors.append(f"术语 g{m} #{rank} 缺字段 {key}")
            g["m"], g["rank"] = m, rank
            gloss.append(g)
    (ROOT / "js" / "glossary.js").write_text(
        "// 由 scripts/build.py 根据 data/glossary/*.json 生成，请勿手改。\n"
        f"window.GLOSSARY = {json.dumps(gloss, ensure_ascii=False, indent=0)};\n", encoding="utf-8")
    print(f"术语卡片：{len(gloss)} 个")

    for s in sets:
        qs = [q for q in bank if q["set"] == s]
        print(f"第 {s} 套：{len(qs)} 题（单选 {sum(q['t'] == 's' for q in qs)}，多选 {sum(q['t'] == 'm' for q in qs)}）")
    print(f"官方模拟题：{sum(q['set'] == 'official' for q in bank)} 题")
    print(f"合计 {len(bank)} 题")
    if errors:
        print("\n问题：\n" + "\n".join(errors))
        sys.exit(1)


if __name__ == "__main__":
    main()
