// src/renderer/src/App.tsx
import { useEffect, useState } from 'react'

interface CollectedItem {
  source: string;
  videoTitle: string;
  channelName: string;
  recommendations: string[];
  timestamp: string;
}

// AIの分析結果を受け取るための厳格な型定義
interface AIMagicData {
  userPersona: string;
  magicName: string;
  element: string;
  impact: string;
  firstStepPrompt: string;
  stats: {
    ワクワク度: number;
    即効性: number;
    難易度: string;
  }
}

export default function App() {
  const [dataList, setDataList] = useState<CollectedItem[]>([])
  const [apiKey, setApiKey] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [magicResult, setMagicResult] = useState<AIMagicData | null>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    // 起動時にローカルファイルから収集済みデータを読み込む
    const fetchData = async () => {
      const data = await window.electronAPI.getCollectedData()
      setDataList(data)
    }
    fetchData()
    
    // バックグラウンドでデータが追加された際のリアルタイム更新リスナー
    window.electronAPI.onDataUpdated(() => fetchData())
    
    return () => window.electronAPI.removeDataUpdatedListener()
  }, [])

  const handleAnalyze = async () => {
    if (!apiKey) {
      setError('Gemini APIキーを入力してください。')
      return
    }
    
    setIsAnalyzing(true)
    setError('')
    setMagicResult(null)

    try {
      // 未経験者に「火をつける」ためのコンテキストプロンプト設計
      const systemPrompt = `
あなたはAIの魅力を伝えるエヴァンジェリストです。
AI未経験者が「自分もAIを使ってみたい！」と熱狂する（火がつく）ように、ユーザーのSNS閲覧履歴から興味・関心を分析し、彼らにぴったりな「AIの活用法」を提案してください。
必ず指定されたJSON構造のみを出力し、マークダウンのバッククォート(\`\`\`)などの余計な文字は一切含めないでください。

{
  "userPersona": "分析から推測されるユーザーの趣味や特徴（例：熱狂的なゲーム愛好家）",
  "magicName": "興味に合わせたキャッチーなAI活用法の名前（例：推し活自動化アイデア）",
  "element": "特徴の属性（例：創造、効率化、分析、自動化 など）",
  "impact": "AIを少し学ぶだけで、ユーザーの今の趣味がどれだけ劇的に便利で面白くなるか、熱量高く150文字程度で語りかけてください。",
  "firstStepPrompt": "未経験者が今すぐChatGPTやGeminiにコピペして試せる、趣味に特化した面白いプロンプト文。",
  "stats": {
    "ワクワク度": "話題と興味のマッチ度を100点満点で評価（例：90）, numberのみで、%や点などの文字は含めないでください",
    "即効性": "プロンプトを試してから効果を実感できるまでの速さを100点満点で評価（例：80）, numberのみで、%や点などの文字は含めないでください",
    "難易度": "プロンプトを使いこなす難しさを「簡単」「普通」「難しい」の3段階で評価（例：簡単）"
  }
}
      `;

      // 解析データのペイロード構築（最新の30件に最適化）
      const recentData = dataList.slice(-30)
      const promptText = `${systemPrompt}\n\n【ユーザーの現在の興味データ（閲覧履歴）】\n${JSON.stringify(recentData, null, 2)}`

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      })

      const resData = await res.json()

      if (!res.ok) {
        throw new Error(resData.error?.message || 'Gemini APIの呼び出しに失敗しました。')
      }

      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text
      if (!rawText) {
        throw new Error('APIから有効なテキスト応答が返されませんでした。')
      }

      // マークダウンのコードブロックが含まれている場合を考慮した正規表現による防御的パース
      const jsonRegex = /\{[\s\S]*\}/
      const match = rawText.match(jsonRegex)
      
      if (!match) {
        throw new Error('返却されたデータが正しいJSONフォーマットではありません。')
      }

      const parsedResult: AIMagicData = JSON.parse(match[0])
      setMagicResult(parsedResult)

    } catch (err: any) {
      console.error('Analysis Error:', err)
      setError(err.message || 'データ解析中に予期せぬエラーが発生しました。')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 💡 興味データ（データベース）を完全に初期化するリセット機能
  const handleClear = async () => {
    if (confirm('これまで収集した「興味データ」を完全に消去し、ゼロからやり直しますか？')) {
      await window.electronAPI.clearData()
      setDataList([])
      setMagicResult(null)
    }
  }

  // 💡 改善1: コピー後にAIツールへ即座に移動させるゼロ・フリクション動線
  const handleCastMagic = () => {
    if (magicResult) {
      navigator.clipboard.writeText(magicResult.firstStepPrompt)
      alert('📜 プロンプトをコピーしました！\n\nOKを押すとAIの画面が開きます。そのまま入力欄に貼り付けて興味をAIと話してください！')
      window.open('https://gemini.google.com/app', '_blank')
    }
  }

  // 💡 改善2: X(Twitter)共有機能によるバイラルループ生成
  const handleShareX = () => {
    if (magicResult) {
      const shareText = `🔥 私だけの独特なアイデアは『${magicResult.magicName}』でした！\n\n属性: ${magicResult.element}\nワクワク度: ${magicResult.stats.ワクワク度}/100\n\nみんなも自分の「好き」からAIと楽しく話そう！\n#AIハッカソン`
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
      window.open(url, '_blank')
    }
  }

  return (
    <>
      <style>
        {`
          html, body, #root {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden !important; 
            background-color: #0f172a;
          }
          .action-btn {
            transition: all 0.2s ease;
          }
          .action-btn:hover {
            transform: translateY(-2px);
            filter: brightness(1.1);
          }
          .action-btn:active {
            transform: translateY(1px);
          }
        `}
      </style>

      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        overflowY: 'auto', 
        overflowX: 'hidden', 
        padding: '3rem 5%', 
        boxSizing: 'border-box', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        color: '#f8fafc', 
        fontFamily: '"Noto Sans JP", sans-serif' 
      }}>
        
        <header style={{ marginBottom: '2.5rem', textAlign: 'center', flexShrink: 0 }}>
          <h1 style={{ fontSize: '3rem', color: '#fbbf24', margin: 0, textShadow: '0 0 15px rgba(251, 191, 36, 0.4)', fontWeight: '900' }}>
            Show Your own AI Idea
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginTop: '0.6rem' }}>あなたの「好き」が、AIを操るアイデアに変わる</p>
        </header>

        <div style={{ width: '100%', maxWidth: '1100px', backgroundColor: '#1e293b', padding: '2.5rem', borderRadius: '16px', border: '1px solid #334155', marginBottom: '2.5rem', boxSizing: 'border-box', flexShrink: 0 }}>
          <input
            type="password"
            placeholder="Gemini API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ width: '100%', padding: '1rem', marginBottom: '1.5rem', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: '1.1rem', boxSizing: 'border-box' }}
          />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '1.3rem', color: '#94a3b8' }}>解析済みの興味: </span>
              <span style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#fbbf24' }}>{dataList.length}</span>
              <span style={{ color: '#6b7280', fontSize: '1.1rem' }}> 件</span>
            </div>
            
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
              <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing || dataList.length === 0}
                className="action-btn"
                style={{ padding: '1rem 2.5rem', fontSize: '1.2rem', fontWeight: 'bold', backgroundColor: isAnalyzing || dataList.length === 0 ? '#475569' : '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: isAnalyzing || dataList.length === 0 ? 'not-allowed' : 'pointer', boxShadow: isAnalyzing || dataList.length === 0 ? 'none' : '0 0 15px rgba(239, 68, 68, 0.5)' }}
              >
                {isAnalyzing ? '🔥 好みを解析中...' : '🔥 AIになげるネタ生成'}
              </button>
              {/* 💡 明確化されたリセットボタン */}
              <button 
                onClick={handleClear} 
                className="action-btn"
                style={{ padding: '1rem 2rem', fontSize: '1.2rem', backgroundColor: 'transparent', color: '#fca5a5', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer' }}
              >
                🗑️ 興味データをリセット
              </button>
            </div>
          </div>
          
          {error && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ color: '#fca5a5', margin: 0, fontWeight: '500' }}>{error}</p>
            </div>
          )}
        </div>

        {magicResult && (
          <div style={{ width: '100%', maxWidth: '1100px', backgroundColor: '#1e293b', border: '2px solid #fbbf24', borderRadius: '16px', padding: '3rem', boxShadow: '0 0 40px rgba(251, 191, 36, 0.2)', boxSizing: 'border-box', marginBottom: '3rem', flexShrink: 0 }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem', paddingBottom: '1.5rem', borderBottom: '1px solid #334155' }}>
              <h2 style={{ fontSize: '1.4rem', color: '#94a3b8', margin: '0 0 0.5rem 0' }}>{magicResult.userPersona}に授けられるアイデア</h2>
              <h1 style={{ fontSize: '3.5rem', color: '#f8fafc', margin: '0', textShadow: '0 2px 4px rgba(0,0,0,0.5)', fontWeight: '900' }}>『{magicResult.magicName}』</h1>
              <span style={{ display: 'inline-block', marginTop: '1.5rem', padding: '0.5rem 2rem', fontSize: '1.2rem', backgroundColor: '#fbbf24', color: '#0f172a', fontWeight: 'bold', borderRadius: '999px' }}>
                属性: {magicResult.element}
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '3rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '320px', backgroundColor: '#0f172a', padding: '2rem', borderRadius: '12px', boxSizing: 'border-box' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: '#cbd5e1', fontSize: '1.3rem', fontWeight: 'bold' }}>📊 ステータス</h3>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                    <span>ワクワク度</span><span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{magicResult.stats.ワクワク度} / 100</span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: '#334155', height: '12px', borderRadius: '6px' }}>
                    <div style={{ width: `${magicResult.stats.ワクワク度}%`, backgroundColor: '#fbbf24', height: '100%', borderRadius: '6px' }}></div>
                  </div>
                </div>
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
                    <span>即効性</span><span style={{ color: '#10b981', fontWeight: 'bold' }}>{magicResult.stats.即効性} / 100</span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: '#334155', height: '12px', borderRadius: '6px' }}>
                    <div style={{ width: `${magicResult.stats.即効性}%`, backgroundColor: '#10b981', height: '100%', borderRadius: '6px' }}></div>
                  </div>
                </div>
                <div style={{ fontSize: '1.2rem' }}>
                  <span style={{ color: '#94a3b8' }}>難易度: </span>
                  <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{magicResult.stats.難易度}</span>
                </div>
              </div>

              <div style={{ flex: '1.5', minWidth: '320px' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: '#cbd5e1', fontSize: '1.4rem', fontWeight: 'bold' }}>✨ これを覚えると…？</h3>
                <p style={{ fontSize: '1.3rem', lineHeight: '1.8', color: '#e2e8f0', margin: 0 }}>{magicResult.impact}</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#3b82f6', padding: '2px', borderRadius: '12px', background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)' }}>
              <div style={{ backgroundColor: '#0f172a', padding: '2rem', borderRadius: '11px' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: '#a78bfa', fontSize: '1.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontWeight: 'bold' }}>
                  <span>📜 自分だけの趣味アイデア（テキストをSNSやAIへ直接入力！）</span>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                      onClick={handleShareX} 
                      className="action-btn"
                      style={{ padding: '0.75rem 1.5rem', fontSize: '1.1rem', backgroundColor: '#1da1f2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Xで独特なアイデアを自慢する
                    </button>
                    <button 
                      onClick={handleCastMagic} 
                      className="action-btn"
                      style={{ padding: '0.75rem 1.5rem', fontSize: '1.1rem', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 0 10px rgba(139, 92, 246, 0.5)' }}
                    >
                      🪄 コピーしてAIを使う
                    </button>
                  </div>
                </h3>
                <div style={{ padding: '1.5rem', backgroundColor: '#1e293b', borderLeft: '5px solid #8b5cf6', color: '#e2e8f0', fontSize: '1.2rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: '1.6', borderRadius: '4px' }}>
                  {magicResult.firstStepPrompt}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}