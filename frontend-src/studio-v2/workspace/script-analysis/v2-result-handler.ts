    const json = await res.json()
    if (!json.success) throw new Error(json.error || '分析无返回')
    
    // ⭐ 后端返回 { success: true, data: { videoSegments, characters, scenes, ... } }
    // 也可能返回 { success: true, data: { success: true, data: {...} } } 嵌套
    let result = json.data || json
    if (result.data && typeof result.data === 'object' && !result.characters && !result.videoSegments) {
      result = result.data
    }
    
    console.log('[analyze] ✅ Narrative Compiler v2 result:', {
      segments: result.videoSegments?.length || 0,
      beats: result.videoSegments?.reduce((s: number, seg: any) => s + (seg.beats?.length || 0), 0) || 0,
      chars: result.characters?.length || 0,
      scenes: result.scenes?.length || 0,
      voices: result.voices?.length || 0,
      props: result.props?.length || 0,
      dialogues: result.dialogues?.length || 0,
      emotionCurve: result.emotionCurve?.length || 0,
      hasBeatsAtTopLevel: result.beats?.length || 0,
    })
    
    // 直接消费后端 normalizeNarrativeSpec 的输出
    // characters
    const chars = (result.characters || []).map((ch: any, i: number) => ({
      id: ch.id || `ch_${i}_${Date.now()}`,
      name: ch.name || ch.characterName || `角色${i + 1}`,
      description: ch.description || ch.personality || '',
      gender: ch.gender || '',
      age: ch.age || '',
      role: ch.role || '',
      personality: ch.personality || '',
      costume: ch.appearance || ch.clothing || '',
      voiceType: ch.voiceType || '',
      expressionSet: [],
      locked: false,
    }))
    
    // scenes
    const scenes = (result.scenes || []).map((sc: any, i: number) => ({
      id: sc.id || `sc_${i}_${Date.now()}`,
      name: sc.name || sc.sceneName || `场景${i + 1}`,
      environment: sc.environment || sc.name || '',
      description: sc.description || '',
      type: sc.type || sc.sceneType || '',
      timeOfDay: sc.timeOfDay || sc.time || '',
      lighting: sc.lighting || '',
      mood: sc.mood || sc.atmosphere || '',
      colorTone: sc.colorTone || '',
      cameraCompatibility: [],
      locked: false,
      weather: '',
    }))
    
    // videoSegments — 保留原始结构
    const videoSegments = result.videoSegments || []
    
    // ⭐ beats: 优先从 videoSegments[].beats 平铺，其次从 result.beats 读取
    let flatBeats: any[] = []
    
    // 方案 A: videoSegments 内有 beats
    if (videoSegments.length > 0) {
      for (const seg of videoSegments) {
        if (seg.beats?.length) {
          for (const beat of seg.beats) {
            flatBeats.push({
              id: beat.id || `beat_${flatBeats.length}`,
              label: beat.label || seg.title || seg.name || `片段 ${flatBeats.length + 1}`,
              startSecond: beat.start ?? beat.startSecond ?? 0,
              endSecond: beat.end ?? beat.endSecond ?? 10,
              camera: beat.camera || '-',
              visual: beat.visual || '',
              dialogue: beat.dialogue || '',
              sound: beat.sound || '',
              emotion: beat.emotion || '',
              effect: beat.effect || '',
              segmentTitle: seg.title || seg.name || '',  // 所属段落名
              summary: beat.visual?.slice(0, 50) || '',
            })
          }
        }
      }
    }
    
    // 方案 B: 顶层 beats（normalize 后的互备）
    if (flatBeats.length === 0 && result.beats?.length) {
      flatBeats = result.beats.map((b: any, i: number) => ({
        id: b.id || `beat_tl_${i}`,
        label: b.label || `片段 ${i + 1}`,
        startSecond: b.startSecond ?? b.start ?? 0,
        endSecond: b.endSecond ?? b.end ?? 10,
        camera: b.camera || '-',
        visual: b.visual || b.summary || '',
        dialogue: b.dialogue || '',
        sound: b.sound || '',
        emotion: b.emotion || '',
        effect: b.effect || '',
        summary: b.summary || b.visual?.slice(0, 50) || '',
      }))
    }
    
    // voices
    const voices = (result.voices || []).map((v: any) => ({
      characterName: v.characterName || v.character || '',
      voiceType: v.voiceType || '',
      speakingStyle: v.speakingStyle || v.style || '',
      pitch: v.pitch ?? 1.0,
      speed: v.speed ?? 1.0,
      ttsPrompt: v.voicePrompt || v.ttsPrompt || '',
      description: (v.description || (v.speakingStyle ? `${v.speakingStyle} · 音高${v.pitch ?? 1.0} · 语速${v.speed ?? 1.0}` : '')),
    }))
    
    // dialogues
    const dialogues = result.dialogues || []
    
    // actions
    const actions = result.actions || []
    
    // props
    const props = (result.props || []).map((p: any) => ({
      name: p.name || '',
      category: p.category || '-',
      description: p.description || '',
    }))
    
    // effectSpecs（替代 emotionCurve，展示特效画面输出）
    const emotionCurve = ((result as any).effectSpecs || []).map((e: any, i: number) => ({
      second: 0,
      emotion: e.effectName || e.visualDescription?.substring(0, 30) || `特效${i + 1}`,
      intensity: 1.0,
      timeIndex: i + 1,
      effectType: e.effectType || '',
      triggerScene: e.triggerScene || '',
      visualDescription: e.visualDescription || '',
    }))

    console.log('[analyze] ✅ v2 结构化完成:', {
      chars: chars.length,
      scenes: scenes.length,
      segments: videoSegments.length,
      beats: flatBeats.length,
      voices: voices.length,
      props: props.length,
      dialogues: dialogues.length,
      emotionCurve: emotionCurve.length,
    })
    
    // 3. 构建新的 narrative state
    const newNarrative = {
      ...current,
      script: data.script.trim(),
      title: scriptTitle.value || data.title || projectNameInput.value,
      characters: chars,
      scenes,
      beats: flatBeats,
      emotionCurve,
      props,
      voices,
      videoSegments,
      dialogues,
      actions,
      extra: { promptVersion: 'compiler-v2' },
    }
    
    store.setNarrative(newNarrative)
    analyzing.value = false
    console.log('[analyze] ✅ Narrative Compiler v2 完成')
    
    // 4. 持久化到服务器
    persistNarrative(projectId)
    
    // 5. 自动触发非阻塞副任务（场景／道具／音色拆解）
    //    v2 已包含这些信息，不再需要额外拆解