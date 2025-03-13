import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import { SrtEntry, TranslationEngine, OutputType } from "../types";
import {
  parseSrt,
  generateSrt,
  checkTranslationStatus,
} from "../utils/srtParser";
import {
  googleTranslate,
  batchTranslate,
  getAvailableEngines,
} from "../utils/translation";

export default function Home() {
  const [srtContent, setSrtContent] = useState("");
  const [entries, setEntries] = useState<SrtEntry[]>([]);
  const [translating, setTranslating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  // 恢复引擎选择，但目前只有Google可用
  const [engine, setEngine] = useState<TranslationEngine>("google");
  const [outputType, setOutputType] = useState<OutputType>("bilingual");
  const [batchSize, setBatchSize] = useState(5);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [translationStatus, setTranslationStatus] = useState<{
    total: number;
    translated: number;
    failed: number;
    pending: number;
  }>({ total: 0, translated: 0, failed: 0, pending: 0 });
  const [errorMessage, setErrorMessage] = useState<string>("");

  // 获取可用引擎
  const availableEngines = getAvailableEngines();

  // 生成预览内容并更新翻译状态
  useEffect(() => {
    if (entries.length > 0) {
      const output = generateSrt(entries, outputType);
      setPreviewContent(output);
      setTranslationStatus(checkTranslationStatus(entries));
    } else {
      setPreviewContent("");
      setTranslationStatus({ total: 0, translated: 0, failed: 0, pending: 0 });
    }
  }, [entries, outputType]);

  // 上传SRT文件
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setSrtContent(content);
      const parsed = parseSrt(content);
      setEntries(parsed);
    };
    reader.readAsText(file);
  };

  // 手动输入SRT内容
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setSrtContent(content);
    if (content.trim()) {
      const parsed = parseSrt(content);
      setEntries(parsed);
    } else {
      setEntries([]);
    }
  };

  // 修改单个翻译
  const handleTranslationChange = (id: string, translation: string) => {
    const newEntries = [...entries];
    const entryIndex = newEntries.findIndex((e) => e.id === id);
    if (entryIndex !== -1) {
      newEntries[entryIndex] = { ...newEntries[entryIndex], translation };
      setEntries(newEntries);
    }
  };

  // 批量翻译
  const handleBatchTranslate = async () => {
    if (entries.length === 0) return;

    setTranslating(true);
    setProgress({ current: 0, total: entries.length });
    setErrorMessage("");

    try {
      const entriesToTranslate = entries.filter(
        (e) =>
          !e.translation ||
          e.translation === "[翻译失败]" ||
          e.translation === "[翻译失败，请重试]"
      );

      if (entriesToTranslate.length === 0) {
        alert("所有条目已翻译完成");
        setTranslating(false);
        return;
      }

      // 将条目分成批次
      const batches = [];
      for (let i = 0; i < entriesToTranslate.length; i += batchSize) {
        batches.push(entriesToTranslate.slice(i, i + batchSize));
      }

      const newEntries = [...entries];
      let successCount = 0;
      let failedCount = 0;

      // 逐批翻译
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchTexts = batch.map((entry) => entry.text);

        try {
          // 批量翻译，传递引擎参数
          const translations = await batchTranslate(batchTexts, engine);

          // 更新翻译结果
          batch.forEach((entry, index) => {
            const entryIndex = newEntries.findIndex((e) => e.id === entry.id);
            if (entryIndex !== -1) {
              const translation = translations[index];
              newEntries[entryIndex] = {
                ...newEntries[entryIndex],
                translation,
              };

              if (translation && !translation.includes("翻译失败")) {
                successCount++;
              } else {
                failedCount++;
              }
            }
          });

          setEntries([...newEntries]);
          setProgress({
            current:
              (i + 1) * batchSize > entriesToTranslate.length
                ? entriesToTranslate.length
                : (i + 1) * batchSize,
            total: entriesToTranslate.length,
          });
        } catch (batchError) {
          console.error("Batch translation error:", batchError);
          // 继续处理下一批，记录错误但不中断整个过程
          failedCount += batch.length;
          setErrorMessage(
            (prev) => prev + `批次 ${i + 1} 翻译失败: ${batchError}\n`
          );
        }

        // 添加短暂延迟，避免请求过于频繁
        if (i < batches.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      if (failedCount > 0) {
        alert(
          `翻译完成，但有 ${failedCount} 个条目翻译失败。您可以单独翻译这些条目。`
        );
      }
    } catch (error) {
      console.error("Translation error:", error);
      setErrorMessage(`翻译过程中发生错误: ${error}`);
      alert("翻译过程中发生错误，请重试");
    } finally {
      setTranslating(false);
    }
  };

  // 单个翻译
  const handleSingleTranslate = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    try {
      const btnElement = document.querySelector(
        `[data-entry-id="${id}"]`
      ) as HTMLButtonElement;
      if (btnElement) {
        btnElement.disabled = true;
        btnElement.textContent = "翻译中...";
      }

      // 使用选择的引擎翻译
      let translation = "";
      if (engine === "google") {
        translation = await googleTranslate(entry.text);
      } else {
        // 默认使用Google翻译
        translation = await googleTranslate(entry.text);
      }

      handleTranslationChange(id, translation);

      // 恢复按钮状态
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.textContent = "翻译此条";
      }
    } catch (error) {
      console.error("Translation error:", error);
      alert(`翻译失败: ${error}`);

      // 恢复按钮状态
      const btnElement = document.querySelector(
        `[data-entry-id="${id}"]`
      ) as HTMLButtonElement;
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.textContent = "翻译此条";
      }
    }
  };

  // 下载SRT文件
  const handleDownload = () => {
    if (entries.length === 0) return;

    const output = generateSrt(entries, outputType);

    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translated_${
      outputType === "bilingual" ? "bilingual" : "chinese"
    }.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container">
      <Head>
        <title>SRT字幕翻译工具</title>
        <meta name="description" content="SRT字幕翻译工具" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">SRT字幕翻译工具</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 输入区域 */}
          <div className="card mb-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">
                上传SRT文件或粘贴内容
              </h2>
              <div className="flex flex-col space-y-4">
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn"
                  >
                    选择SRT文件
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".srt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                <textarea
                  value={srtContent}
                  onChange={handleContentChange}
                  rows={10}
                  placeholder="或者在此粘贴SRT内容..."
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">翻译设置</h2>
              <div className="flex flex-col space-y-4">
                {/* 恢复翻译引擎选项 */}
                <div className="flex items-center space-x-2">
                  <span>翻译引擎:</span>
                  <select
                    value={engine}
                    onChange={(e) =>
                      setEngine(e.target.value as TranslationEngine)
                    }
                    className="border rounded p-2"
                  >
                    {availableEngines.map((engine) => (
                      <option key={engine.id} value={engine.id}>
                        {engine.name} - {engine.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <span>输出格式:</span>
                  <select
                    value={outputType}
                    onChange={(e) =>
                      setOutputType(e.target.value as OutputType)
                    }
                    className="border rounded p-2"
                  >
                    <option value="bilingual">双语字幕</option>
                    <option value="chinese">中文字幕</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <span>批量大小:</span>
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="border rounded p-2"
                  >
                    <option value="1">1 (最慢)</option>
                    <option value="3">3 (推荐)</option>
                    <option value="5">5</option>
                    <option value="10">10 (较快，可能触发限制)</option>
                  </select>
                  <span className="text-xs text-gray-500 ml-2">
                    较大批量可能触发Google限制
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <button
                  onClick={handleBatchTranslate}
                  disabled={entries.length === 0 || translating}
                  className="btn"
                >
                  {translating
                    ? `翻译中...(${progress.current}/${progress.total})`
                    : "批量翻译"}
                </button>

                <button
                  onClick={handleDownload}
                  disabled={
                    entries.length === 0 || !entries.some((e) => e.translation)
                  }
                  className="btn-secondary"
                >
                  下载SRT
                </button>
              </div>

              {/* 翻译状态指示器 */}
              {entries.length > 0 && (
                <div className="mt-4 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>总条目: {translationStatus.total}</span>
                    <span>已翻译: {translationStatus.translated}</span>
                    <span>失败: {translationStatus.failed}</span>
                    <span>待翻译: {translationStatus.pending}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full mt-2">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{
                        width: `${
                          translationStatus.total
                            ? (translationStatus.translated /
                                translationStatus.total) *
                              100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}

              {/* 错误消息显示 */}
              {errorMessage && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  <div className="font-medium mb-1">
                    翻译过程中出现以下错误:
                  </div>
                  <pre className="whitespace-pre-wrap">{errorMessage}</pre>
                </div>
              )}
            </div>
          </div>

          {/* 预览区域 */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">SRT预览</h2>
            <textarea
              value={previewContent}
              readOnly
              rows={15}
              className="font-mono text-sm bg-gray-50 w-full p-2 border rounded"
            />
          </div>
        </div>

        {/* 条目编辑区域 */}
        {entries.length > 0 && (
          <div className="card mt-8">
            <h2 className="text-xl font-semibold mb-4">字幕编辑</h2>
            <div className="border-t border-gray-200">
              {entries.map((entry) => (
                <div key={entry.id} className="py-4 border-b border-gray-200">
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>{entry.index}</span>
                    <span>{entry.timeCode}</span>
                  </div>
                  <div className="mb-2">
                    <p className="font-semibold">原文:</p>
                    <p className="whitespace-pre-wrap mb-1">{entry.text}</p>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <p className="font-semibold">译文:</p>
                      <button
                        onClick={() => handleSingleTranslate(entry.id)}
                        className={`px-2 py-1 text-xs ${
                          entry.translation &&
                          !entry.translation.includes("翻译失败")
                            ? "bg-green-500"
                            : "bg-blue-500"
                        } text-white rounded hover:bg-blue-600`}
                        disabled={translating}
                        data-entry-id={entry.id}
                      >
                        翻译此条
                      </button>
                    </div>
                    <textarea
                      value={entry.translation || ""}
                      onChange={(e) =>
                        handleTranslationChange(entry.id, e.target.value)
                      }
                      rows={2}
                      className={`font-mono text-sm w-full p-2 border rounded ${
                        entry.translation &&
                        entry.translation.includes("翻译失败")
                          ? "border-red-300 bg-red-50"
                          : ""
                      }`}
                      placeholder="在此编辑翻译结果..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-gray-500 text-sm">
        SRT字幕翻译工具 &copy; {new Date().getFullYear()}{" "}
        <a href="https://dogxi.me" className="text-blue-400">
          Dogxi
        </a>
      </footer>
    </div>
  );
}
