<template>
  <div class="video-workspace-rework">
    <div class="workspace-toolbar">
      <div class="toolbar-title">🎥 视频生成 — AI 导演</div>
      <div class="toolbar-actions">
        <button class="btn-merge" @click="mergeVideos" :disabled="mergeState.merging">
          {{ mergeState.merging ? '⏳ 合成中...' : '🎬 合成完整视频' }}
        </button>
        <button class="btn-next" @click="goToNextStage">下一步：配音生成 →</button>
      </div>
    </div>

    <div class="workspace-body">
      <!-- ====== 中间栏（滚动列表） ====== -->
      <div class="center-panel">
        <!-- 音色生成卡片区域 — 在中间栏上方是视频生成卡片 -->
        <div class="card-list" @drop.prevent="onAssetDrop($event)" @dragover.prevent="onDragOver">
          <div
            v-for="(seg, i) in segments"
            :key="seg.id"
            class="video-card"
            :class="{ active: selectedSegmentIndex === i }"
            @click="selectedSegmentIndex = i"
          >
            <div class="card-header">
              <span class="card-title">片段 {{ i + 1 }}</span>
              <span class="card-seg-title">{{ seg.title || '未命名' }}</span>
            </div>

            <!-- 1. 剧情描述 -->
            <div class="field-group">
              <label class="field-label">📝 剧情描述
                <span style="font-size:0.7rem;color:rgba(255,255,255,0.3);margin-left:8px;font-weight:400;">
                  （建议包含景别·运镜·动作·光线，如：特写推进→中景摇移）
                </span>
              </label>
              <textarea
                class="field-input narrative"
                :value="getSegmentData(i).narrative"
                @input="updateSegmentField(i, 'narrative', ($event.target as HTMLTextAreaElement).value)"
                placeholder="【示例】特写镜头缓慢推进，角色眼神低垂。中景转换，镜头跟随角色走向窗边…"
                rows="4"
              ></textarea>
            </div>

            <!-- 2. 对话文本 -->
            <div class="field-group">
              <label class="field-label">💬 对话文本</label>
              <textarea
                class="field-input dialogue"
                :value="getSegmentData(i).dialogue"
                @input="updateSegmentField(i, 'dialogue', ($event.target as HTMLTextAreaElement).value)"
                placeholder="输入这段剧情的对话/台词（将对口型生成）…"
                rows="2"
              ></textarea>
            </div>

            <!-- 3. 特效音效描述 -->
            <div class="field-group">
              <label class="field-label">🔊 特效音效描述</label>
              <textarea
                class="field-input effects"
                :value="getSegmentData(i).effects"
                @input="updateSegmentField(i, 'effects', ($event.target as HTMLTextAreaElement).value)"
                placeholder="输入特效和音效的描述…"
                rows="2"
              ></textarea>
            </div>

            <!-- 3.5 情绪描述 -->
            <div class="field-group">
              <label class="field-label">🎭 情绪描述</label>
              <textarea
                class="field-input emotion"
                :value="getSegmentData(i).emotion"
                @input="updateSegmentField(i, 'emotion', ($event.target as HTMLTextAreaElement).value)"
                placeholder="角色情绪、微表情描述…"
                rows="1"
              ></textarea>
            </div>

            <!-- 3.6 负面提示词 -->
            <div class="field-group">
              <label class="field-label">🚫 负面提示词</label>
              <textarea
                class="field-input negative"
                :value="getSegmentData(i).negativePrompt"
                @input="updateSegmentField(i, 'negativePrompt', ($event.target as HTMLTextAreaElement).value)"
                placeholder="防止人物变形、画面崩坏（如：扭曲、异常肢体、多指等）…"
                rows="1"
              ></textarea>
            </div>

            <!-- 4. AI 优化按钮 -->
            <button
              class="btn-optimize"
              :disabled="optimizingIdx === i"
              @click.stop="handleOptimize(i)"
            >
              {{ optimizingIdx === i ? '⏳ 优化中…' : '🎬 AI 优化视频脚本' }}
            </button>

            <!-- 5. 引用数据区域（角色参考图 + 音色 + 三帧缩略图） -->
            <div class="ref-section">
              <!-- 角色引用图（多角色防形象漂移） -->
              <div class="ref-group">
                <div class="ref-label">👤 角色参考图 <span class="ref-hint">（勾选后提交给视频模型参考）</span></div>
                <div v-if="(state.workspace.characters || []).length > 0" class="ref-chars">
                  <label v-for="(ch, fi) in (state.workspace.characters || [])" :key="'card-c'+fi" class="char-check-item">
                    <div class="ref-thumb-wrapper">
                      <img v-if="ch.imageUrl" :src="ch.imageUrl" class="char-check-thumb"
                        :class="{ selected: isCharCardSelected(i, ch) }"
                        :title="ch.name || '角色图'"
                      />
                      <div v-else class="char-check-thumb char-check-thumb-empty" title="暂无图片，可从素材库选择">👤</div>
                      <button class="ref-replace-btn" title="从素材库替换图片" @click.prevent.stop="openAssetPickReplace('character', ch, '角色')">📂</button>
                    </div>
                    <input type="checkbox" :checked="isCharCardSelected(i, ch)"
                      @change="toggleCharCardImage(i, ch)" class="char-checkbox" />
                    <span class="char-check-name">{{ ch.name || ch.characterName || `角色 ${fi+1}` }}</span>
                  </label>
                </div>
                <div v-else class="ref-empty">暂无角色，请先在角色设定页面创建</div>
              </div>
              <!-- 场景引用图（场景背景参考） -->
              <div class="ref-group" style="margin-top:8px;">
                <div class="ref-label">🌄 场景参考图 <span class="ref-hint">（勾选后提交给视频模型参考，所有场景图可多选）</span></div>
                <div v-if="(state.workspace.scenes || []).length > 0" class="ref-chars">
                  <label v-for="(sc, fi) in (state.workspace.scenes || [])" :key="'card-s'+fi" class="char-check-item">
                    <div class="ref-thumb-wrapper">
                      <img v-if="sc.imageUrl" :src="sc.imageUrl" class="char-check-thumb"
                        :class="{ selected: isSceneCardSelected(i, sc) }"
                        :title="sc.name || '场景图'"
                      />
                      <div v-else class="char-check-thumb char-check-thumb-empty" title="暂无图片，可从素材库选择">🌄</div>
                      <button class="ref-replace-btn" title="从素材库替换图片" @click.prevent.stop="openAssetPickReplace('scene', sc, '场景')">📂</button>
                    </div>
                    <input type="checkbox" :checked="isSceneCardSelected(i, sc)"
                      @change="toggleSceneCardImage(i, sc)" class="char-checkbox" />
                    <span class="char-check-name">{{ sc.name || `场景 ${fi+1}` }}</span>
                  </label>
                </div>
                <div v-else class="ref-empty">暂无场景，请先在场景设定页面创建</div>
              </div>
              <!-- 道具引用图（道具 + 所属角色锁定） -->
              <div class="ref-group" style="margin-top:8px;">
                <div class="ref-label">🛡️ 道具参考图 <span class="ref-hint">（勾选后提交给视频模型参考，显示所属角色）</span></div>
                <div v-if="(propImages || []).length > 0" class="ref-chars">
                  <label v-for="(prop, fi) in (propImages || [])" :key="'card-p'+fi" class="char-check-item">
                    <div class="ref-thumb-wrapper">
                      <img v-if="prop.imageUrl" :src="prop.imageUrl" class="char-check-thumb"
                        :class="{ selected: isPropCardSelected(i, prop) }"
                        :title="(prop.name || '道具') + (prop.character ? ' · ' + prop.character : '')"
                      />
                      <div v-else class="char-check-thumb char-check-thumb-empty" title="暂无图片，可从素材库选择">📷</div>
                      <button class="ref-replace-btn" title="从素材库替换图片" @click.prevent.stop="openAssetPickReplace('prop', prop, '道具')">📂</button>
                    </div>
                    <input type="checkbox" :checked="isPropCardSelected(i, prop)"
                      @change="togglePropCardImage(i, prop)" class="char-checkbox" />
                    <span class="char-check-name">{{ prop.name || prop.propName || `道具 ${fi+1}` }}</span>
                    <span v-if="prop.character" class="char-check-character">👤{{ prop.character }}</span>
                  </label>
                </div>
                <div v-else class="ref-empty">暂无道具，请先在道具设计页面创建</div>
              </div>
              <div class="ref-group">
                <div class="ref-label">🎵 引用音色文件</div>
                <div v-if="voiceUrls.length > 0" class="ref-voices">
                  <div v-for="(voice, vi) in voiceUrls" :key="vi" class="voice-item">
                    <span class="voice-name">{{ voice.characterName || `音色 ${vi + 1}` }}</span>
                    <audio v-if="voice.url" :src="voice.url" controls class="voice-player"></audio>
                    <span v-else class="ref-empty">无文件</span>
                  </div>
                </div>
                <div v-else class="ref-empty">暂无音色文件</div>
              </div>

              <!-- 首中尾帧图 -->
              <div class="ref-group">
                <div class="ref-label">🎬 首帧图</div>
                <div class="ref-selected-row" v-if="segmentFirstFrameUrls[i]">
                  <img :src="proxyImageUrl(segmentFirstFrameUrls[i])" class="ref-thumb-sm" />
                  <button class="btn-ref-replace" @click.stop="framePickerMode='firstFrame';framePickerSegIdx=i;framePickerImages=getFramePickerImages();framePickerShow=true">🔄 替换</button>
                </div>
                <div v-else class="ref-empty">未生成</div>
              </div>
              <div class="ref-group">
                <div class="ref-label">🎬 中帧图（第{{ Math.floor(((segments[i]?.duration || 8)/2)) }}秒）</div>
                <div class="ref-selected-row" v-if="segmentMidFrameUrls[i]">
                  <img :src="proxyImageUrl(segmentMidFrameUrls[i])" class="ref-thumb-sm" />
                  <button class="btn-ref-replace" @click.stop="framePickerMode='midFrame';framePickerSegIdx=i;framePickerImages=getFramePickerImages();framePickerShow=true">🔄 替换</button>
                </div>
                <div v-else class="ref-empty">未生成</div>
              </div>
              <div class="ref-group">
                <div class="ref-label">🎬 尾帧图（最后一秒）</div>
                <div class="ref-selected-row" v-if="segmentLastFrameUrls[i]">
                  <img :src="proxyImageUrl(segmentLastFrameUrls[i])" class="ref-thumb-sm" />
                  <button class="btn-ref-replace" @click.stop="framePickerMode='lastFrame';framePickerSegIdx=i;framePickerImages=getFramePickerImages();framePickerShow=true">🔄 替换</button>
                </div>
                <div v-else class="ref-empty">未生成</div>
              </div>
              <button class="btn-generate-frames" :disabled="generatingFrames[i]" @click="generateThreeFrames(i)">
                {{ generatingFrames[i] ? '⏳ 生成帧图中…' : '🎞️ 生成首中尾帧图' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ====== 分割线（中间栏 3/4 处） ====== -->
        <div class="divider"></div>
      </div>

      <!-- ====== 右侧栏：三帧卡片 + 折叠表单 + 视频生成 ====== -->
      <div class="right-panel">
        <!-- 未选中片段时显示提示 -->
        <div v-if="selectedSegmentIndex < 0" class="empty-state">
          <div class="empty-icon">🎬</div>
          <div class="empty-text">从左侧选择一个片段开始编辑</div>
        </div>

        <!-- 选中片段时显示详情 -->
        <div v-else class="segment-detail">
          <!-- ====== 三张帧图卡片（横向排列） ====== -->
          <div class="frame-cards-row">
            <!-- 首帧图卡片 -->
            <div class="frame-card">
              <div class="frame-card-header">🎬 首帧图（第0秒）</div>
              <div class="frame-preview-area">
                <img v-if="segmentFirstFrameUrls[selectedSegmentIndex]" :src="proxyImageUrl(segmentFirstFrameUrls[selectedSegmentIndex])" class="frame-preview-img" @click="previewImageUrl = segmentFirstFrameUrls[selectedSegmentIndex]" />
                <div v-else class="frame-preview-empty">未生成</div>
              </div>
              <label class="frame-field-label">📝 画面描述</label>
              <textarea
                class="frame-field-input"
                :value="frameDescriptions[selectedSegmentIndex]?.first || ''"
                @input="updateFrameDesc(selectedSegmentIndex, 'first', ($event.target as HTMLTextAreaElement).value)"
                placeholder="根据AI优化结果自动填入帧画面描述…"
                rows="2"
              ></textarea>
              <div class="frame-refs">
                <div class="frame-ref-label">🎭 角色图 <span class="ref-hint">（点击选中）</span>：</div>
                <div class="frame-ref-thumbs">
                  <template v-if="(state.workspace.characters || []).filter((c:any)=>c.imageUrl).length">
                    <img v-for="(ch, fi) in (state.workspace.characters || []).filter((c:any)=>c.imageUrl)" :key="'first-c'+fi"
                      :src="ch.imageUrl" class="frame-ref-thumb" :class="{ selected: isCharSelected(selectedSegmentIndex, ch, 'first') }"
                      :title="ch.name || '角色图'" @click="toggleCharImage(selectedSegmentIndex, ch, 'first')" />
                  </template>
                  <span v-else class="ref-empty">暂无</span>
                </div>
              </div>
              <div class="frame-refs">
                <div class="frame-ref-label">🌄 场景图 <span class="ref-hint">（点击选中）</span>：</div>
                <div class="frame-ref-thumbs">
                  <template v-if="(state.workspace.scenes || []).filter((s:any)=>s.imageUrl).length">
                    <img v-for="(sc, fi) in (state.workspace.scenes || []).filter((s:any)=>s.imageUrl)" :key="'first-s'+fi"
                      :src="sc.imageUrl" class="frame-ref-thumb" :class="{ selected: isSceneSelected(selectedSegmentIndex, sc, 'first') }"
                      :title="sc.name || '场景图'" @click="toggleSceneImage(selectedSegmentIndex, sc, 'first')" />
                  </template>
                  <span v-else class="ref-empty">暂无</span>
                </div>
              </div>
              <div class="frame-refs">
                <div class="frame-ref-label">🛡️ 道具图 <span class="ref-hint">（点击选中）</span>：</div>
                <div class="frame-ref-thumbs">
                  <template v-if="(propImages || []).filter((p:any)=>p.imageUrl || p.whiteBgUrl).length">
                    <img v-for="(prop, fi) in (propImages || []).filter((p:any)=>p.imageUrl || p.whiteBgUrl)" :key="'first-p'+fi"
                      :src="prop.imageUrl || prop.whiteBgUrl" class="frame-ref-thumb" :class="{ selected: isPropSelected(selectedSegmentIndex, { imageUrl: prop.imageUrl || prop.whiteBgUrl }, 'first') }"
                      :title="prop.name || '道具图'" @click="togglePropImage(selectedSegmentIndex, { imageUrl: prop.imageUrl || prop.whiteBgUrl }, 'first')" />
                  </template>
                  <span v-else class="ref-empty">暂无</span>
                </div>
              </div>
              <label class="frame-field-label">🤖 图生图 Prompt</label>
              <textarea
                class="frame-field-input prompt"
                :value="framePrompts[selectedSegmentIndex]?.first?.prompt || ''"
                @input="updateFramePrompt(selectedSegmentIndex, 'first', 'prompt', ($event.target as HTMLTextAreaElement).value)"
                placeholder="图生图用的 prompt…"
                rows="2"
              ></textarea>
              <label class="frame-field-label">🚫 Negative Prompt</label>
              <textarea
                class="frame-field-input neg"
                :value="framePrompts[selectedSegmentIndex]?.first?.negativePrompt || ''"
                @input="updateFramePrompt(selectedSegmentIndex, 'first', 'negativePrompt', ($event.target as HTMLTextAreaElement).value)"
                placeholder="负面提示词…"
                rows="1"
              ></textarea>
              <div class="frame-actions">
                <button class="btn-opt-prompt" :disabled="frameOpting[selectedSegmentIndex]?.first" @click="optimizeFramePrompt(selectedSegmentIndex, 'first')">
                  {{ frameOpting[selectedSegmentIndex]?.first ? '⏳ 优化中…' : '🤖 AI优化提示词' }}
                </button>
                <button class="btn-img2img" :disabled="frameGenning[selectedSegmentIndex]?.first" @click="generateFrameImage(selectedSegmentIndex, 'first')">
                  {{ frameGenning[selectedSegmentIndex]?.first ? '⏳ 生成中…' : '🎨 图生图' }}
                </button>
              </div>
            </div>

            <div class="frame-card">
              <div class="frame-card-header">🎬 尾帧图（最后一秒）</div>
              <div class="frame-preview-area">
                <img v-if="segmentLastFrameUrls[selectedSegmentIndex]" :src="proxyImageUrl(segmentLastFrameUrls[selectedSegmentIndex])" class="frame-preview-img" @click="previewImageUrl = segmentLastFrameUrls[selectedSegmentIndex]" />
                <div v-else class="frame-preview-empty">未生成</div>
              </div>
              <!-- ⭐ 帧间继承：显示中帧图作为参考 -->
              <div v-if="segmentMidFrameUrls[selectedSegmentIndex]" class="frame-inherit-row">
                <span class="frame-inherit-label">⬆ 继承中帧图：</span>
                <img :src="proxyImageUrl(segmentMidFrameUrls[selectedSegmentIndex])" class="frame-inherit-thumb" title="中帧结果图，作为本帧的主要参考" />
                <span class="frame-inherit-desc">主参考图</span>
              </div>
              <label class="frame-field-label">📝 画面描述</label>
              <textarea
                class="frame-field-input"
                :value="frameDescriptions[selectedSegmentIndex]?.last || ''"
                @input="updateFrameDesc(selectedSegmentIndex, 'last', ($event.target as HTMLTextAreaElement).value)"
                placeholder="根据AI优化结果自动填入帧画面描述…"
                rows="2"
              ></textarea>
              <div class="frame-refs">
                <div class="frame-ref-label">🎭 角色图 <span class="ref-hint">（点击选中）</span>：</div>
                <div class="frame-ref-thumbs">
                  <template v-if="(state.workspace.characters || []).filter((c:any)=>c.imageUrl).length">
                    <img v-for="(ch, fi) in (state.workspace.characters || []).filter((c:any)=>c.imageUrl)" :key="'last-c'+fi"
                      :src="ch.imageUrl" class="frame-ref-thumb" :class="{ selected: isCharSelected(selectedSegmentIndex, ch, 'last') }"
                      :title="ch.name || '角色图'" @click="toggleCharImage(selectedSegmentIndex, ch, 'last')" />
                  </template>
                  <span v-else class="ref-empty">暂无</span>
                </div>
              </div>
              <div class="frame-refs">
                <div class="frame-ref-label">🌄 场景图 <span class="ref-hint">（点击选中）</span>：</div>
                <div class="frame-ref-thumbs">
                  <template v-if="(state.workspace.scenes || []).filter((s:any)=>s.imageUrl).length">
                    <img v-for="(sc, fi) in (state.workspace.scenes || []).filter((s:any)=>s.imageUrl)" :key="'last-s'+fi"
                      :src="sc.imageUrl" class="frame-ref-thumb" :class="{ selected: isSceneSelected(selectedSegmentIndex, sc, 'last') }"
                      :title="sc.name || '场景图'" @click="toggleSceneImage(selectedSegmentIndex, sc, 'last')" />
                  </template>
                  <span v-else class="ref-empty">暂无</span>
                </div>
              </div>
              <div class="frame-refs">
                <div class="frame-ref-label">🛡️ 道具图 <span class="ref-hint">（点击选中）</span>：</div>
                <div class="frame-ref-thumbs">
                  <template v-if="(propImages || []).filter((p:any)=>p.imageUrl || p.whiteBgUrl).length">
                    <img v-for="(prop, fi) in (propImages || []).filter((p:any)=>p.imageUrl || p.whiteBgUrl)" :key="'last-p'+fi"
                      :src="prop.imageUrl || prop.whiteBgUrl" class="frame-ref-thumb" :class="{ selected: isPropSelected(selectedSegmentIndex, { imageUrl: prop.imageUrl || prop.whiteBgUrl }, 'last') }"
                      :title="prop.name || '道具图'" @click="togglePropImage(selectedSegmentIndex, { imageUrl: prop.imageUrl || prop.whiteBgUrl }, 'last')" />
                  </template>
                  <span v-else class="ref-empty">暂无</span>
                </div>
              </div>
              <label class="frame-field-label">🤖 图生图 Prompt</label>
              <textarea
                class="frame-field-input prompt"
                :value="framePrompts[selectedSegmentIndex]?.last?.prompt || ''"
                @input="updateFramePrompt(selectedSegmentIndex, 'last', 'prompt', ($event.target as HTMLTextAreaElement).value)"
                placeholder="图生图用的 prompt…"
                rows="2"
              ></textarea>
              <label class="frame-field-label">🚫 Negative Prompt</label>
              <textarea
                class="frame-field-input neg"
                :value="framePrompts[selectedSegmentIndex]?.last?.negativePrompt || ''"
                @input="updateFramePrompt(selectedSegmentIndex, 'last', 'negativePrompt', ($event.target as HTMLTextAreaElement).value)"
                placeholder="负面提示词…"
                rows="1"
              ></textarea>
              <div class="frame-actions">
                <button class="btn-opt-prompt" :disabled="frameOpting[selectedSegmentIndex]?.last" @click="optimizeFramePrompt(selectedSegmentIndex, 'last')">
                  {{ frameOpting[selectedSegmentIndex]?.last ? '⏳ 优化中…' : '🤖 AI优化提示词' }}
                </button>
                <button class="btn-img2img" :disabled="frameGenning[selectedSegmentIndex]?.last" @click="generateFrameImage(selectedSegmentIndex, 'last')">
                  {{ frameGenning[selectedSegmentIndex]?.last ? '⏳ 生成中…' : '🎨 图生图' }}
                </button>
              </div>
            </div>
          </div>

          <!-- ====== AIGC 编辑内容（常开） ====== -->
          <div class="collapse-section open">

            <div class="aigc-form" style="margin-top:12px;">
              <div class="field-group">
                <label class="field-label">📝 剧情描述
                <span style="font-size:0.7rem;color:rgba(255,255,255,0.3);margin-left:8px;font-weight:400;">
                  （建议包含：景别·运镜·角色动作·光线氛围，如：特写推进→中景摇移→全景拉远）
                </span>
              </label>
                <textarea
                  class="field-input narrative"
                  :value="getSegmentData(selectedSegmentIndex).narrative"
                  @input="updateSegmentField(selectedSegmentIndex, 'narrative', ($event.target as HTMLTextAreaElement).value)"
                  placeholder="【示例】特写镜头缓慢推进，角色眼神低垂，眼角含泪。中景转换为全景，镜头跟随角色走向窗边，光影从左侧洒入…"
                  rows="4"
                ></textarea>
              </div>
              <div class="field-group">
                <label class="field-label">💬 对话文本</label>
                <textarea
                  class="field-input dialogue"
                  :value="getSegmentData(selectedSegmentIndex).dialogue"
                  @input="updateSegmentField(selectedSegmentIndex, 'dialogue', ($event.target as HTMLTextAreaElement).value)"
                  placeholder="输入对话/台词（将对口型生成）…"
                  rows="2"
                ></textarea>
              </div>
              <div class="field-group">
                <label class="field-label">🔊 特效音效描述</label>
                <textarea
                  class="field-input effects"
                  :value="getSegmentData(selectedSegmentIndex).effects"
                  @input="updateSegmentField(selectedSegmentIndex, 'effects', ($event.target as HTMLTextAreaElement).value)"
                  placeholder="输入特效和音效的描述…"
                  rows="2"
                ></textarea>
              </div>
              <div class="field-group">
                <label class="field-label">🚫 负面提示词</label>
                <textarea
                  class="field-input negative"
                  :value="getSegmentData(selectedSegmentIndex).negativePrompt"
                  @input="updateSegmentField(selectedSegmentIndex, 'negativePrompt', ($event.target as HTMLTextAreaElement).value)"
                  placeholder="防止画面崩坏（如：扭曲、异常肢体、多指等）…"
                  rows="1"
                ></textarea>
              </div>
              <div class="field-group">
                <label class="field-label">⏱️ 视频时长：{{ segmentDuration[selectedSegmentIndex] || 8 }} 秒</label>
                <input type="range" min="3" max="15" step="1"
                  :value="segmentDuration[selectedSegmentIndex] || 8"
                  @input="setSegmentDuration(selectedSegmentIndex, Number(($event.target as HTMLInputElement).value))"
                  class="duration-slider" />
                <div class="duration-labels">
                  <span>3s</span>
                  <span>15s</span>
                </div>
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">🤖 视频模型</label>
              <select v-model="selectedVideoModel" class="field-input model-select">
                <option v-for="m in videoModelOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </div>

            <div class="detail-header" style="margin-top:12px;">
              <span class="detail-title">视频生成</span>
              <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
              <button class="btn-optimize-video-prompt" :disabled="optimizingVideoPrompt" @click="optimizeVideoNarrative">
                {{ optimizingVideoPrompt ? '⏳ 优化中…' : '🎬 AI 优化视频描述' }}
              </button>
              <button class="btn-generate-video" :disabled="generatingVideo" @click="generateCurrentVideo">
                {{ generatingVideo ? '⏳ 生成中…' : '🎬 生成视频' }}
              </button>
            </div>
            </div>



            <div v-if="generatedVideos[selectedSegmentIndex]" class="generated-video-section" style="margin-top:12px;">
              <div class="gen-label">已生成视频</div>
              <video :src="generatedVideos[selectedSegmentIndex]" controls class="preview-video"></video>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ====== 图片替换选择器弹窗 ====== -->
    <div v-if="pickerState.show" class="picker-overlay" @click.self="closePicker">
      <div class="picker-dialog">
        <div class="picker-header">
          <span class="picker-title">选择{{ {char:'角色图',scene:'场景图',prop:'道具图',firstFrame:'首帧图'}[pickerState.mode] }}</span>
          <button class="picker-close" @click="closePicker">✕</button>
        </div>
        <div class="picker-grid" v-if="pickerState.images.length > 0">
          <div v-for="(img, pi) in pickerState.images"
            :key="pi"
            class="picker-item"
            @click="pickImage(img.url)"
          >
            <img :src="img.url" class="picker-thumb" />
            <span class="picker-label">{{ img.label }}</span>
          </div>
        </div>
        <div v-else class="picker-empty">暂无可用图片，请先在素材库生成</div>
      </div>
    </div>

    <!-- ====== 帧图替换选择器弹窗 ====== -->
    <div v-if="framePickerShow" class="picker-overlay" @click.self="framePickerShow=false">
      <div class="picker-dialog">
        <div class="picker-header">
          <span class="picker-title">选择{{ {firstFrame:'首帧图',midFrame:'中帧图',lastFrame:'尾帧图'}[framePickerMode] }}</span>
          <button class="picker-close" @click="framePickerShow=false">✕</button>
        </div>
        <div class="picker-grid" v-if="framePickerImages.length > 0">
          <div
            v-for="(img, pi) in framePickerImages"
            :key="pi"
            class="picker-item"
            @click="pickFrameImage(img.url)"
          >
            <img :src="proxyImageUrl(img.url)" class="picker-thumb" />
            <span class="picker-label">{{ img.label }}</span>
          </div>
        </div>
        <div v-else class="picker-empty">暂无可用图片</div>
      </div>
    </div>
  <!-- 大图预览弹窗 -->
  <div v-if="previewImageUrl" class="image-preview-overlay" @click.self="previewImageUrl = ''">
    <img :src="proxyImageUrl(previewImageUrl)" class="image-preview-large" @click="previewImageUrl = ''" />
    <span class="image-preview-close" @click="previewImageUrl = ''">✕</span>
  </div>
</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'
import { useSegmentRuntime } from '~/studio-v2/workspace/director/useSegmentRuntime'
import type { SegmentRuntime } from '~/studio-v2/types/runtime/index'

const { state, projectId, goToStage, setActiveSegment } = useStudioStore()
const { segments } = useSegmentRuntime()

// ─── Token helper ───
function getAuthToken(): string {
  try {
    const { getToken: _gt } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
    return _gt()
  } catch { return '' }
}

// ====== 状态 ======
const selectedSegmentIndex = ref(-1)
const selectedVideoModel = ref('doubao-seedance-1-5-pro-251215')

/** 可选视频模型列表 */
const videoModelOptions = [
  { value: 'doubao-seedance-1-5-pro-251215', label: '🔥 火山豆包 Seedance 1.5 Pro (推荐)' },
  { value: 'doubao-seedance-2-0-pro-260510', label: '🚀 火山豆包 Seedance 2.0 Pro' },
  { value: 'wan2.7-i2v', label: '☁️ 阿里万相 2.7 图生视频' },
  { value: 'wan2.7-t2v', label: '☁️ 阿里万相 2.7 文生视频' },
  { value: 'wan2.6-r2v', label: '☁️ 阿里万相 2.6 参考图视频' },
  { value: 'wan2.7-r2v', label: '☁️ 阿里万相 2.7 参考图视频' },
  { value: 'wan2.6-r2v-flash', label: '⚡ 阿里万相 2.6 R2V Flash' },
  { value: 'happyhorse-1.0-r2v', label: '🐴 阿里 HappyHorse 1.0 R2V' },
  { value: 'happyhorse-1.0-t2v', label: '🐴 阿里 HappyHorse 1.0 文生视频' },
  { value: 'wan2.6-i2v-flash', label: '⚡ 阿里万相 2.6 I2V Flash' },
];
const optimizingIdx = ref<number | null>(null)
/** 大图预览 URL */
const previewImageUrl = ref('')

// 每个片段的编辑数据（narrative / dialogue / effects / emotion / negativePrompt）
interface SegmentEditFields {
  narrative: string
  dialogue: string
  effects: string
  emotion: string
  negativePrompt: string
}
const segmentEditData = reactive<Record<number, SegmentEditFields>>({})

// 每个片段引用的角色图片 URL 列表（key: `${idx}_${frameType}`）
const segmentCharImages = reactive<Record<string, string[]>>({})
// 每个片段引用的场景图片 URL 列表（key: `${idx}_${frameType}`）
const segmentSceneImages = reactive<Record<string, string[]>>({})

// AI 优化结果（按片段索引）
const optimizedResults = reactive<Record<number, any>>({})

// 生成的视频 URL（按片段索引）
const generatedVideos = ref<Record<number, string>>({})

// ====== 帧图卡片状态 ======
// 每帧的画面描述（AI优化后自动填入）
const frameDescriptions = reactive<Record<number, { first: string; mid: string; last: string }>>({})
// 每帧的图生图 prompt + negativePrompt
const framePrompts = reactive<Record<number, { first: { prompt: string; negativePrompt: string }; mid: { prompt: string; negativePrompt: string }; last: { prompt: string; negativePrompt: string } }>>({})
// AI提示词优化中状态
const frameOpting = reactive<Record<number, { first?: boolean; mid?: boolean; last?: boolean }>>({})
// 图生图生成中状态
const frameGenning = reactive<Record<number, { first?: boolean; mid?: boolean; last?: boolean }>>({})

// 角色列表
const characters = ref<any[]>([])

// 角色图片列表（全部可用的）
const charImages = ref<any[]>([])
// 场景图片列表（全部可用的）
const sceneImages = ref<any[]>([])
// 道具图片列表（全部可用的）
const propImages = ref<any[]>([])

// 每个片段引用的道具图片 URL 列表（key: `${idx}_${frameType}`）
const segmentPropImages = reactive<Record<string, string[]>>({})

// 每个片段的首帧图索引
const selectedFirstFrameIndex = ref(-1)
/** 当前选定首帧图的 URL */
const selectedFirstFrameUrl = ref('')
// ⭐ 首中尾帧图（每段视频只生成3张帧图替代逐秒帧）
const segmentFirstFrameUrls = ref<Record<number, string>>({})   // 首帧图片URL
const segmentMidFrameUrls = ref<Record<number, string>>({})     // 中帧图片URL
const segmentLastFrameUrls = ref<Record<number, string>>({})    // 尾帧图片URL
const generatingFrames = ref<Record<number, boolean>>({})       // 正在生成帧图中

// 火山 TOS CORS 代理：将火山图片 URL 转为本地代理
function proxyImageUrl(rawUrl: string): string {
  if (!rawUrl) return ''
  if (rawUrl.includes('tos-cn-beijing.volces.com') || rawUrl.includes('volces.com')) {
    return '/api/proxy/image?url=' + encodeURIComponent(rawUrl)
  }
  return rawUrl
}
/** 可选的首帧图列表（场景图 + 角色图 + assets 分镜图） */
const availableFirstFrames = computed(() => {
  const frames: { url: string; label: string }[] = []
  try {
    const workspace = state.workspace || {} as any
    // 场景图
    const scenes = workspace.scenes || []
    for (const s of scenes) {
      if (s?.imageUrl) frames.push({ url: s.imageUrl, label: s.name || '场景图' })
    }
    // 角色图
    const chars = workspace.characters || []
    for (const c of chars) {
      if (c?.imageUrl) frames.push({ url: c.imageUrl, label: c.name || '角色图' })
    }
    // assets 中的分镜图
    const storeStateAssets = (state as any)?.assets?.assets || []
    for (const a of storeStateAssets) {
      if (a?.type === 'storyboard' && a?.thumbnail) {
        frames.push({ url: a.thumbnail, label: '分镜:' + (a.name || a.id?.substring(0, 6) || '') })
      }
    }
  } catch (e) {
    console.warn('[VideoGeneration] availableFirstFrames 计算失败:', e)
  }
  return frames
})

// 音色文件列表（保留：视频合成时传递音色参考给后端）
const voiceUrls = ref<{ characterName: string; url: string }[]>([])
const generatingVideo = ref(false)
const optimizingVideoPrompt = ref(false)
const segmentDuration = reactive<Record<number, number>>({})

function setSegmentDuration(idx: number, val: number) {
  segmentDuration[idx] = Math.max(3, Math.min(15, val))
}

// ====== AI 优化视频描述（镜头语言） ======
async function optimizeVideoNarrative() {
  const idx = selectedSegmentIndex.value
  if (idx < 0) { alert('请先选择段落'); return }
  const data = getSegmentData(idx)
  if (!data.narrative?.trim()) { alert('请先填写剧情描述'); return }

  optimizingVideoPrompt.value = true
  try {
    const token = getAuthToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const { videoStyle: videoStyleRef } = useStudioStore()
    const videoStyle = videoStyleRef.value

    const res = await fetch('/api/ai/optimize-video-prompt', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        segmentNarrative: data.narrative,
        dialogue: data.dialogue || '',
        effects: data.effects || '',
        duration: segmentDuration[idx] || 8,
        firstFrameDesc: frameDescriptions[idx]?.first || '',
        midFrameDesc: frameDescriptions[idx]?.mid || '',
        lastFrameDesc: frameDescriptions[idx]?.last || '',
        videoStyle: videoStyle || '3d',
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      alert('优化失败: ' + (errText || `HTTP ${res.status}`))
      return
    }

    const json = await res.json()
    if (json.success && json.data?.optimizedNarrative) {
      // 替换当前段所有内容：剧情 / 对话 / 特效 / 三帧画面描述
      updateSegmentField(idx, 'narrative', json.data.optimizedNarrative)
      if (json.data.optimizedDialogue) {
        updateSegmentField(idx, 'dialogue', json.data.optimizedDialogue)
      }
      if (json.data.optimizedEffects) {
        updateSegmentField(idx, 'effects', json.data.optimizedEffects)
      }

      // ⭐ 将三帧优化描述填入画面描述框
      if (!frameDescriptions[idx]) {
        frameDescriptions[idx] = { first: '', mid: '', last: '' }
      }
      if (json.data.optimizedFirstFrame) {
        frameDescriptions[idx].first = json.data.optimizedFirstFrame
      }
      if (json.data.optimizedMidFrame) {
        frameDescriptions[idx].mid = json.data.optimizedMidFrame
      }
      if (json.data.optimizedLastFrame) {
        frameDescriptions[idx].last = json.data.optimizedLastFrame
      }

      alert('✅ 视频描述已用镜头语言优化，对话/特效/三帧画面描述已全部填入')
    } else {
      alert('优化返回数据异常: ' + JSON.stringify(json))
    }
  } catch (err) {
    console.warn('[optimizeVideoNarrative] error:', err)
    alert('优化出错: ' + (err instanceof Error ? err.message : '未知错误'))
  } finally {
    optimizingVideoPrompt.value = false
  }
}

// ====== 从 DB 加载已持久化的段编辑状态 ======
async function loadSegmentEditState() {
  const pid = projectId.value
  if (!pid) return
  try {
    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/projects/segments/' + pid, { headers })
    if (!res.ok) return
    const json = await res.json()
    if (!json.success || !json.data?.segments?.length) return

    for (const seg of json.data.segments) {
      const idx = seg.sortOrder
      if (idx === undefined || idx === null) continue
      if (seg.firstFrameUrl) segmentFirstFrameUrls.value[idx] = seg.firstFrameUrl
      if (seg.midFrameUrl) segmentMidFrameUrls.value[idx] = seg.midFrameUrl
      if (seg.lastFrameUrl) segmentLastFrameUrls.value[idx] = seg.lastFrameUrl
      if (seg.firstFrameDesc || seg.midFrameDesc || seg.lastFrameDesc) {
        if (!frameDescriptions[idx]) frameDescriptions[idx] = { first: '', mid: '', last: '' }
        if (seg.firstFrameDesc) frameDescriptions[idx].first = seg.firstFrameDesc
        if (seg.midFrameDesc) frameDescriptions[idx].mid = seg.midFrameDesc
        if (seg.lastFrameDesc) frameDescriptions[idx].last = seg.lastFrameDesc
      }
      if (!segmentEditData[idx]) segmentEditData[idx] = { narrative: '', dialogue: '', effects: '', emotion: '', negativePrompt: '' }
      if (seg.narrative) segmentEditData[idx].narrative = seg.narrative
      if (seg.dialogue) segmentEditData[idx].dialogue = seg.dialogue
      if (seg.effects) segmentEditData[idx].effects = seg.effects
      if (seg.emotion) segmentEditData[idx].emotion = seg.emotion
      if (seg.negativePrompt) segmentEditData[idx].negativePrompt = seg.negativePrompt
      if (seg.duration && seg.duration > 0) segmentDuration[idx] = seg.duration
      if (seg.firstFramePrompt || seg.firstFrameNeg || seg.midFramePrompt || seg.midFrameNeg || seg.lastFramePrompt || seg.lastFrameNeg) {
        if (!framePrompts[idx]) framePrompts[idx] = { first: { prompt: '', negativePrompt: '' }, mid: { prompt: '', negativePrompt: '' }, last: { prompt: '', negativePrompt: '' } }
        if (seg.firstFramePrompt) framePrompts[idx].first.prompt = seg.firstFramePrompt
        if (seg.firstFrameNeg) framePrompts[idx].first.negativePrompt = seg.firstFrameNeg
        if (seg.midFramePrompt) framePrompts[idx].mid.prompt = seg.midFramePrompt
        if (seg.midFrameNeg) framePrompts[idx].mid.negativePrompt = seg.midFrameNeg
        if (seg.lastFramePrompt) framePrompts[idx].last.prompt = seg.lastFramePrompt
        if (seg.lastFrameNeg) framePrompts[idx].last.negativePrompt = seg.lastFrameNeg
      }
      if (seg.charImageUrls?.length) segmentCharImages[idx + '_first'] = seg.charImageUrls
      if (seg.sceneImageUrls?.length) segmentSceneImages[idx + '_first'] = seg.sceneImageUrls
      if (seg.propImageUrls?.length) segmentPropImages[idx + '_first'] = seg.propImageUrls
      if (seg.videoUrl) generatedVideos.value[idx] = seg.videoUrl
    }
    console.log('[segment-state] ' + (json.data.segments.length) + ' 段编辑状态已加载')
  } catch (err) {
    console.warn('[segment-state] 加载失败:', err)
  }
}

// ====== 保存段编辑状态到 DB ======
async function saveSegmentEditState(idx: number) {
  const pid = projectId.value
  if (!pid || idx < 0) return
  const data = getSegmentData(idx)
  const seg = segments.value[idx]
  if (!seg) return

  try {
    const token = getAuthToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = 'Bearer ' + token

    await fetch('/api/projects/segments/save', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: pid,
        segmentId: seg.id || seg.segmentId || String(idx),
        sortOrder: idx,
        firstFrameUrl: segmentFirstFrameUrls.value[idx] || '',
        midFrameUrl: segmentMidFrameUrls.value[idx] || '',
        lastFrameUrl: segmentLastFrameUrls.value[idx] || '',
        firstFrameDesc: frameDescriptions[idx]?.first || '',
        midFrameDesc: frameDescriptions[idx]?.mid || '',
        lastFrameDesc: frameDescriptions[idx]?.last || '',
        narrative: data.narrative || '',
        dialogue: data.dialogue || '',
        effects: data.effects || '',
        emotion: data.emotion || '',
        negativePrompt: data.negativePrompt || '',
        duration: segmentDuration[idx] || 8,
        firstFramePrompt: framePrompts[idx]?.first?.prompt || '',
        firstFrameNeg: framePrompts[idx]?.first?.negativePrompt || '',
        midFramePrompt: framePrompts[idx]?.mid?.prompt || '',
        midFrameNeg: framePrompts[idx]?.mid?.negativePrompt || '',
        lastFramePrompt: framePrompts[idx]?.last?.prompt || '',
        lastFrameNeg: framePrompts[idx]?.last?.negativePrompt || '',
        charImageUrls: segmentCharImages[idx + '_first'] || [],
        sceneImageUrls: segmentSceneImages[idx + '_first'] || [],
        propImageUrls: segmentPropImages[idx + '_first'] || [],
        videoUrl: generatedVideos.value[idx] || '',
      }),
    })
  } catch (err) {
    console.warn('[segment-state] 保存失败:', err)
  }
}

// 首次加载完成标记（用于防止 watch 在 onMounted 之前重复触发）
const initialized = ref(false)

// 从 store 获取角色信息
const workspaceCharacters = computed(() => state.workspace.characters || [])

// ====== 初始化：加载数据 ======
onMounted(async () => {
  await loadRefData()
  // 加载完图片数据后初始化编辑数据（自动匹配角色/场景/道具图）
  initEditData()
  // 从 DB 加载持久化的编辑状态（覆盖内存数据）
  await loadSegmentEditState()
  initialized.value = true
})

watch(segments, () => {
  // ⭐ 仅在首次加载完成后才同步编辑数据，避免竞态
  if (!initialized.value) return
  initEditData()
}, { deep: true })

function initEditData() {
  // ⭐ 优先从 state.workspace.narrative.videoSegments 读取（画面设计师完整输出）
  const vs = state.workspace.narrative?.videoSegments || []
  // ⭐ 降级到 state.workspace.segments（在 segments 数量匹配时使用）
  const fallbackSegments = segments.value

  for (let i = 0; i < Math.max(vs.length, fallbackSegments.length); i++) {
    // 优先从 videoSegments 读取，降级到 segments
    const vsItem = vs[i]
    const fallbackItem = fallbackSegments[i]
    const source = vsItem || fallbackItem

    const segNarrative = source?.narrativePurpose || vsItem?.fullText || source?.fullText || ''
    const segEffects = source?.backgroundMusic || ''

    // 从 store 的 narrative.dialogues 提取本片段的对话文本
    const storeDialogues: any[] = state.workspace.narrative?.dialogues || []
    const segDialogues = storeDialogues
      .filter((d: any) => d.segmentId === (vsItem?.segmentId || source?.id || ''))
      .map((d: any) => d.characterName + '：' + d.dialogue)
      .join('\n')

    // 从 store 的 narrative.effects 补充特效描述（按索引分配）
    const storeEffects: any[] = state.workspace.narrative?.effects || []
    // ⭐ 将 effectSpecs 按索引或场景名分配到对应 segment
    const segIdxEffects = storeEffects
      .filter((ef: any) => {
        // 如果有 segment 索引匹配
        if (ef.segmentIndex !== undefined) return ef.segmentIndex === i
        // 如果有 segmentName 匹配
        if (ef.segmentName && source?.title) return ef.segmentName.includes(source.title) || source.title.includes(ef.segmentName)
        return false
      })
    const segExtraEffects = segIdxEffects.length > 0
      ? segIdxEffects.map((e: any) => `${e.name || e.effectName}（${e.type || e.effectType}）：${e.description || e.notes || e.desc || ''}`).join('\n')
      // ⭐ 没有明确分配到 segment 时，将全局特效按顺序均分到各 segment
      : storeEffects.length > 0
        ? storeEffects
            .filter((_: any, ei: number) => ei % Math.max(vs.length || fallbackSegments.length, 1) === i % Math.max(vs.length || fallbackSegments.length, 1))
            .map((e: any) => `${e.name || e.effectName}（${e.type || e.effectType}）：${e.description || e.notes || e.desc || ''}`)
            .join('\n')
        : ''
    const effectsText = [segEffects, segExtraEffects].filter(Boolean).join('\n\n')
    
    // 从 store 的 emotionSpecs 获取情绪/微表情描述
    const emotionSpecs: any[] = state.workspace.narrative?.emotionSpecs || []
    const segEmotion = emotionSpecs[i] || {}
    const emotionText = [
      segEmotion.emotion ? `情绪：${segEmotion.emotion}` : '',
      segEmotion.expression ? `表情：${segEmotion.expression}` : '',
      segEmotion.microExpression ? `微表情：${segEmotion.microExpression}` : '',
      segEmotion.description || '',
    ].filter(Boolean).join('\n')
    
    segmentEditData[i] = {
      narrative: segNarrative,
      dialogue: segDialogues,
      effects: effectsText,
      emotion: emotionText,
    }

    if (!segmentCharImages[i]) {
      segmentCharImages[i] = []
    }
    if (!segmentSceneImages[i]) {
      segmentSceneImages[i] = []
    }
    if (!segmentPropImages[i]) {
      segmentPropImages[i] = []
    }

    // ⭐ 自动匹配角色图：根据 segment 的角色名列表，匹配 store 中已生成的角色图片
    const storeChars = state.workspace.characters || []
    const segChars = source?.characters || fallbackItem?.characters || []
    if (segChars.length > 0 && !segmentCharImages[i].length) {
      for (const charName of segChars) {
        const match = storeChars.find(c => (c.name === charName || c.id === charName) && c.imageUrl)
        if (match && !segmentCharImages[i].includes(match.imageUrl)) {
          segmentCharImages[i].push(match.imageUrl)
        }
      }
    }

    // ⭐ 自动匹配场景图：根据 segment 的场景名，匹配 store 中已生成的场景图片
    const storeScenes = state.workspace.scenes || []
    const segScenes = source?.scene ? [source.scene] : (fallbackItem?.scenes || [])
    if (segScenes.length > 0 && !segmentSceneImages[i].length) {
      for (const sceneName of segScenes) {
        const match = storeScenes.find(s => (s.name === sceneName || s.id === sceneName) && s.imageUrl)
        if (match && !segmentSceneImages[i].includes(match.imageUrl)) {
          segmentSceneImages[i].push(match.imageUrl)
        }
      }
    }

    // ⭐ 自动匹配道具图：根据 store 中 narrative.props 分配
    const storeProps: any[] = (state.workspace.narrative as any)?.props || []
    if (storeProps.length > 0 && !segmentPropImages[i].length) {
      // 每个片段分配一个道具（按索引均分）
      const propIdx = i % storeProps.length
      const prop = storeProps[propIdx]
      if (prop?.imageUrl) {
        segmentPropImages[i].push(prop.imageUrl)
      }
    }

    // ⭐ 自动设置首帧图：使用本 segment 的场景图或角色图
    if (!selectedFirstFrameUrl.value) {
      const segSceneUrl = segmentSceneImages[i]?.[0]
      const segCharUrl = segmentCharImages[i]?.[0]
      if (segSceneUrl) {
        selectedFirstFrameUrl.value = segSceneUrl
      } else if (segCharUrl) {
        selectedFirstFrameUrl.value = segCharUrl
      }
    }
  }
}

async function loadRefData() {
  const pid = projectId.value
  if (!pid) return

  // 优先从 store 加载角色图片和场景图片
  const storeChars = state.workspace.characters || []
  const storeScenes = state.workspace.scenes || []
  const storeAssets = state.assets.assets || []

  // 从 store 的 characters 中提取有 imageUrl 的角色
  if (storeChars.some(ch => ch.imageUrl)) {
    charImages.value = storeChars
      .filter(ch => ch.imageUrl)
      .map(ch => ({
        id: ch.id,
        characterName: ch.name || ch.id,
        imageUrl: ch.imageUrl,
        description: ch.description || '',
      }))
  }

  // 从 store 的 scenes 中提取有 imageUrl 的场景
  if (storeScenes.some(sc => sc.imageUrl)) {
    sceneImages.value = storeScenes
      .filter(sc => sc.imageUrl)
      .map(sc => ({
        id: sc.id,
        sceneName: sc.name || sc.id,
        imageUrl: sc.imageUrl,
        description: sc.description || '',
      }))
  }

  // 从 store 获取角色列表
  characters.value = storeChars.length > 0 ? storeChars : state.workspace.characters || []

  // 从 store 的 narrative.props 获取道具图片（含 character 关联信息）
  const storeProps = (state.workspace?.narrative as any)?.props || []
  if (storeProps.some((p: any) => p.imageUrl)) {
    propImages.value = storeProps
      .filter((p: any) => p.imageUrl)
      .map((p: any) => ({
        id: p.id || '',
        name: p.name || p.propName || '道具',
        propName: p.name || p.propName || '道具',
        imageUrl: p.imageUrl,
        whiteBgUrl: p.whiteBgUrl || p.imageUrl,
        character: p.character || p.characterName || '',
      }))
  }
  // Fallback: 从 store/assets 获取道具图片（不含 character 关联）
  if (propImages.value.length === 0 && storeAssets.some(a => a.type === 'prop' && (a.imageUrl || a.whiteBgUrl))) {
    propImages.value = storeAssets
      .filter(a => a.type === 'prop' && (a.imageUrl || a.whiteBgUrl))
      .map(a => ({
        id: a.id,
        name: a.name || a.propName || '道具',
        propName: a.name || a.propName || '道具',
        imageUrl: a.imageUrl || a.whiteBgUrl,
        whiteBgUrl: a.whiteBgUrl,
        character: '',
      }))
  }

  // 从 store 的 voices 中提取音色
  const storeVoices = (state as any).workspace?.voices || []
  if (storeVoices.length > 0) {
    voiceUrls.value = storeVoices.map((v: any) => ({
      characterName: v.characterName || '',
      url: v.url || v.voiceUrl || '',
    }))
  }

  // 如果 store 数据不足，fallback 到独立的 fetch
  const needCharFetch = charImages.value.length === 0
  const needSceneFetch = sceneImages.value.length === 0

  try {
    const token = getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    if (needCharFetch) {
      const charRes = await fetch(`/api/execution-images/characters/${pid}`, { headers })
      if (charRes.ok) {
        const charData = await charRes.json()
        if (charData.success && charData.data) {
          charImages.value = charData.data
        }
      }
    }

    if (needSceneFetch) {
      const sceneRes = await fetch(`/api/execution-images/scenes/${pid}`, { headers })
      if (sceneRes.ok) {
        const sceneData = await sceneRes.json()
        if (sceneData.success && sceneData.data) {
          sceneImages.value = sceneData.data
        }
      }
    }

    // 如果 store 没有角色数据，fallback 到 store 的 characters
    if (characters.value.length === 0) {
      characters.value = workspaceCharacters.value.length > 0
        ? workspaceCharacters.value
        : state.workspace.characters || []
    }

    // 如果 store 没有音色数据，fallback 到 API
    if (voiceUrls.value.length === 0) {
      const storeVoices2 = (state as any).workspace?.voices || []
      voiceUrls.value = storeVoices2.map((v: any) => ({
        characterName: v.characterName || '',
        url: v.url || v.voiceUrl || '',
      }))
    }

    // 如果 store 还是没有音色，从 voice/records API 加载已保存的音色
    if (voiceUrls.value.length === 0 && pid) {
      try {
        const voiceRes = await fetch(`/api/voice/records?projectId=${pid}`, { headers })
        if (voiceRes.ok) {
          const voiceJson = await voiceRes.json()
          if (voiceJson.success && voiceJson.data?.length) {
            voiceUrls.value = voiceJson.data.map((r: any) => ({
              characterName: r.characterName || '',
              url: (r.audioUrl || '').replace(/^http:\/\//i, 'https://'),
            }))
          }
        }
      } catch {}
    }

    // ⭐ 从 store 恢复已保存的优化结果
    const savedOpt = state.workspace.narrative?.optimizedResults
    if (savedOpt && typeof savedOpt === 'object') {
      for (const key of Object.keys(savedOpt)) {
        const idx = Number(key)
        if (!isNaN(idx) && savedOpt[idx]) {
          optimizedResults[idx] = savedOpt[idx]
        }
      }
    }
  } catch (err) {
    console.warn('[VideoGeneration] loadRefData error:', err)
  }

  // ⭐ 数据加载完成后再初始化编辑数据 & 标记已完成
  initEditData()
  initialized.value = true
}

function getSegmentData(index: number): { narrative: string; dialogue: string; effects: string; emotion: string; negativePrompt: string } {
  if (!segmentEditData[index]) {
    segmentEditData[index] = { narrative: '', dialogue: '', effects: '', emotion: '', negativePrompt: '' }
  }
  return segmentEditData[index]
}

function updateSegmentField(index: number, field: 'narrative' | 'dialogue' | 'effects' | 'emotion' | 'negativePrompt', value: string) {
  if (!segmentEditData[index]) {
    segmentEditData[index] = { narrative: '', dialogue: '', effects: '', emotion: '', negativePrompt: '' }
  }
  segmentEditData[index][field] = value
}

function isCharSelected(segIdx: number, img: any, frameType: string): boolean {
  const key = `${segIdx}_${frameType}`
  const selected = segmentCharImages[key] || []
  return selected.includes(img.imageUrl)
}

function toggleCharImage(segIdx: number, img: any, frameType: string) {
  const key = `${segIdx}_${frameType}`
  if (!segmentCharImages[key]) {
    segmentCharImages[key] = []
  }
  const idx = segmentCharImages[key].indexOf(img.imageUrl)
  if (idx >= 0) {
    segmentCharImages[key].splice(idx, 1)
  } else {
    segmentCharImages[key].push(img.imageUrl)
  }
  // 自动持久化到后端
  saveSegmentEditState(segIdx)
}

function isSceneSelected(segIdx: number, img: any, frameType: string): boolean {
  const key = `${segIdx}_${frameType}`
  const selected = segmentSceneImages[key] || []
  return selected.includes(img.imageUrl)
}

function toggleSceneImage(segIdx: number, img: any, frameType: string) {
  const key = `${segIdx}_${frameType}`
  if (!segmentSceneImages[key]) {
    segmentSceneImages[key] = []
  }
  const idx = segmentSceneImages[key].indexOf(img.imageUrl)
  if (idx >= 0) {
    segmentSceneImages[key].splice(idx, 1)
  } else {
    segmentSceneImages[key].push(img.imageUrl)
  }
  saveSegmentEditState(segIdx)
}
function isCharCardSelected(segIdx: number, ch: any): boolean {
  const key = `${segIdx}_first`
  const selected = segmentCharImages[key] || []
  return selected.includes(ch.imageUrl)
}

function toggleCharCardImage(segIdx: number, ch: any) {
  toggleCharImage(segIdx, ch, 'first')
}

function isPropSelected(segIdx: number, img: any, frameType: string): boolean {
  const key = `${segIdx}_${frameType}`
  const selected = segmentPropImages[key] || []
  return selected.includes(img.imageUrl)
}

function isSceneCardSelected(segIdx: number, sc: any): boolean {
  const key = `${segIdx}_first`
  const selected = segmentSceneImages[key] || []
  return selected.includes(sc.imageUrl)
}

function toggleSceneCardImage(segIdx: number, sc: any) {
  toggleSceneImage(segIdx, sc, 'first')
}

function isPropCardSelected(segIdx: number, prop: any): boolean {
  const key = `${segIdx}_first`
  const selected = segmentPropImages[key] || []
  return selected.includes(prop.imageUrl)
}

function togglePropCardImage(segIdx: number, prop: any) {
  if (!prop.imageUrl) return
  togglePropImage(segIdx, { imageUrl: prop.imageUrl }, 'first')
}

function togglePropImage(segIdx: number, img: any, frameType: string) {
  const key = `${segIdx}_${frameType}`
  if (!segmentPropImages[key]) {
    segmentPropImages[key] = []
  }
  const idx = segmentPropImages[key].indexOf(img.imageUrl)
  if (idx >= 0) {
    segmentPropImages[key].splice(idx, 1)
  } else {
    segmentPropImages[key].push(img.imageUrl)
  }
}

// ====== 图片替换选择器 ======
// ⭐ 从素材库替换中间卡缩略图：直接替换目标对象的 imageUrl
function openAssetPickReplace(mode: 'character' | 'scene' | 'prop', item: any, label: string) {
  const store2 = useStudioStore()
  store2.setAssetCategory(mode)
  store2.toggleAssetSidebar()
  window.__onAssetPickCallback = function onPick(asset: any) {
    window.__onAssetPickCallback = undefined
    if (!asset) return
    const url = asset.url || asset.thumbnail || ''
    if (!url) return
    item.imageUrl = url
  }
}

type PickerMode = 'char' | 'scene' | 'prop' | 'firstFrame'
const pickerState = reactive<{
  show: boolean
  mode: PickerMode
  segIdx: number
  itemIdx: number
  images: { url: string; label: string }[]
}>({
  show: false,
  mode: 'char',
  segIdx: -1,
  itemIdx: -1,
  images: [],
})

function getAvailableImages(mode: PickerMode): { url: string; label: string }[] {
  try {
    if (mode === 'char') {
      const storeChars = state.workspace.characters || []
      return storeChars.filter(c => c.imageUrl).map(c => ({ url: c.imageUrl, label: c.name || c.id }))
    }
    if (mode === 'scene') {
      const storeScenes = state.workspace.scenes || []
      return storeScenes.filter(s => s.imageUrl).map(s => ({ url: s.imageUrl, label: s.name || s.id }))
    }
    if (mode === 'prop') {
      const props: any[] = (state.workspace.narrative as any)?.props || []
      return props.filter(p => p.imageUrl).map(p => ({ url: p.imageUrl, label: p.name }))
    }
    if (mode === 'firstFrame') {
      const frames: { url: string; label: string }[] = []
      const scenes = state.workspace.scenes || []
      for (const s of scenes) { if (s?.imageUrl) frames.push({ url: s.imageUrl, label: s.name || '场景图' }) }
      const chars = state.workspace.characters || []
      for (const c of chars) { if (c?.imageUrl) frames.push({ url: c.imageUrl, label: c.name || '角色图' }) }
      const assets = (state as any)?.assets?.assets || []
      for (const a of assets) { if (a?.type === 'storyboard' && a?.thumbnail) frames.push({ url: a.thumbnail, label: '分镜:' + (a.name || '') }) }
      return frames
    }
    return []
  } catch { return [] }
}

function openCharPicker(segIdx: number, itemIdx: number) {
  pickerState.mode = 'char'
  pickerState.segIdx = segIdx
  pickerState.itemIdx = itemIdx
  pickerState.images = getAvailableImages('char')
  pickerState.show = true
}

function openScenePicker(segIdx: number, itemIdx: number) {
  pickerState.mode = 'scene'
  pickerState.segIdx = segIdx
  pickerState.itemIdx = itemIdx
  pickerState.images = getAvailableImages('scene')
  pickerState.show = true
}

function openPropPicker(segIdx: number, itemIdx: number) {
  pickerState.mode = 'prop'
  pickerState.segIdx = segIdx
  pickerState.itemIdx = itemIdx
  pickerState.images = getAvailableImages('prop')
  pickerState.show = true
}

function openFirstFramePicker(segIdx: number) {
  pickerState.mode = 'firstFrame'
  pickerState.segIdx = segIdx
  pickerState.itemIdx = -1
  pickerState.images = getAvailableImages('firstFrame')
  pickerState.show = true
}

function pickImage(url: string) {
  const { mode, segIdx, itemIdx } = pickerState
  if (mode === 'char') {
    if (!segmentCharImages[segIdx]) segmentCharImages[segIdx] = []
    if (itemIdx >= 0 && itemIdx < segmentCharImages[segIdx].length) {
      segmentCharImages[segIdx][itemIdx] = url
    }
  } else if (mode === 'scene') {
    if (!segmentSceneImages[segIdx]) segmentSceneImages[segIdx] = []
    if (itemIdx >= 0 && itemIdx < segmentSceneImages[segIdx].length) {
      segmentSceneImages[segIdx][itemIdx] = url
    }
  } else if (mode === 'prop') {
    if (!segmentPropImages[segIdx]) segmentPropImages[segIdx] = []
    if (itemIdx >= 0 && itemIdx < segmentPropImages[segIdx].length) {
      segmentPropImages[segIdx][itemIdx] = url
    }
  } else if (mode === 'firstFrame') {
    selectedFirstFrameUrl.value = url
  }
  pickerState.show = false
}

function closePicker() {
  pickerState.show = false
}

function selectFirstFrame(index: number, url: string) {
  selectedFirstFrameIndex.value = index
  selectedFirstFrameUrl.value = url
}

// ====== AI 优化 ======
async function handleOptimize(index: number) {
  const seg = segments.value[index]
  if (!seg) return

  optimizingIdx.value = index

  // ⭐ 清空旧的优化结果缓存，确保每次 AI 优化都是全新的 JSON
  optimizedResults[index] = undefined
  delete optimizedResults[index]

  const data = getSegmentData(index)
  const charImgs = segmentCharImages[index] || []
  const sceneImgs = segmentSceneImages[index] || []
  const propImgs = segmentPropImages[index] || []

  try {
    const token = getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    // ⭐ 收集选中场景的详细描述（用于约束 AI 不要随意构建新场景）
    const selectedScenesDetail = (state.workspace.scenes || [])
      .filter((s: any) => sceneImgs.includes(s.imageUrl))
      .map((s: any) => ({
        name: s.name || '',
        environment: s.environment || s.description || '',
      }))
    // ⭐ 收集选中角色的服装/外貌（用于约束 AI 对角色样貌的描述一致性）
    const selectedCharsDetail = (state.workspace.characters || [])
      .filter((c: any) => charImgs.includes(c.imageUrl))
      .map((c: any) => ({
        name: c.name || '',
        costume: c.costume || '',
        appearance: c.description || c.appearance || '',
      }))

    // ⭐ 使用 optimize-shot-script 逐秒优化
    const res = await fetch('/api/ai/optimize-shot-script', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        segmentId: seg.id,
        narrative: data.narrative || '',
        dialogue: data.dialogue || '',
        effects: data.effects || '',
        charImages: charImgs,
        sceneImages: sceneImgs,
        propImages: propImgs,
        charDetails: selectedCharsDetail,
        sceneDetails: selectedScenesDetail,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn('[handleOptimize] 请求失败:', res.status, errText)
      alert('优化请求失败: ' + (errText || `HTTP ${res.status}`))
      return
    }

    const json = await res.json()
    if (json.success && json.data) {
      // 保存优化结果到本地 reactive（用于右侧展示）
      optimizedResults[index] = json.data

      // ⭐ 回写到对应的输入框
      if (json.data.narrative) {
        segmentEditData[index].narrative = json.data.narrative
      }
      if (json.data.dialogue) {
        segmentEditData[index].dialogue = json.data.dialogue
      }
      if (json.data.effects) {
        segmentEditData[index].effects = json.data.effects
      }
      // ⭐ 回写负面提示词
      if (json.data.negativePrompt) {
        segmentEditData[index].negativePrompt = json.data.negativePrompt
      }

      // ⭐ 自动填入帧图画面描述
      if (!frameDescriptions[index]) {
        frameDescriptions[index] = { first: '', mid: '', last: '' }
      }
      if (json.data.firstFrameDescription) {
        frameDescriptions[index].first = json.data.firstFrameDescription
      }
      if (json.data.midFrameDescription) {
        frameDescriptions[index].mid = json.data.midFrameDescription
      }
      if (json.data.lastFrameDescription) {
        frameDescriptions[index].last = json.data.lastFrameDescription
      }

      // ⭐ 持久化到 store
      const narrative = state.workspace.narrative || {}
      narrative.optimizedResults = narrative.optimizedResults || {}
      narrative.optimizedResults[index] = json.data
      narrative.executionResults = narrative.executionResults || {}
      narrative.executionResults.optimizedResults = narrative.executionResults.optimizedResults || {}
      narrative.executionResults.optimizedResults[index] = json.data
      state.workspace.narrative = narrative
    }
  } catch (err) {
    console.warn('[handleOptimize] error:', err)
  } finally {
    optimizingIdx.value = index
    setTimeout(() => { optimizingIdx.value = null }, 500)
  }
}

function formatShotSecond(second: number): string {
  if (Number.isInteger(second)) return `${second}s`
  return `${second.toFixed(1)}s`
}

/** 从 store 的场景列表中取第一个场景图 */
function getFirstSceneImage(): string {
  try {
    const scenes = state.workspace.scenes || []
    return scenes.find((s: any) => s.imageUrl)?.imageUrl || ''
  } catch { return '' }
}

/** 从 store 的角色列表中取第一张角色图 */
function getFirstCharacterImage(): string {
  try {
    const chars = state.workspace.characters || []
    return chars.find((c: any) => c.imageUrl)?.imageUrl || ''
  } catch { return '' }
}

/** 从 assets 列表取第一张分镜图或场景图 */
function findFirstFrameFromAssets(): string {
  try {
    const assets = state.assets.assets || []
    // storyboard 类型优先
    const storyboard = assets.find((a: any) => a.type === 'storyboard' && a.thumbnail)
    if (storyboard) return storyboard.thumbnail
    // scene 类型次之
    const scene = assets.find((a: any) => a.type === 'scene' && a.thumbnail)
    if (scene) return scene.thumbnail
    // 任意有缩略图的
    const anyAsset = assets.find((a: any) => a.thumbnail)
    return anyAsset?.thumbnail || ''
  } catch { return '' }
}

/** 把 AI 优化结果应用到编辑表单 */
function applyOptimizedToForm(index: number) {
  const opt = optimizedResults[index]
  if (!opt) return
  if (opt.narrative) segmentEditData[index].narrative = opt.narrative
  if (opt.dialogue) segmentEditData[index].dialogue = opt.dialogue
  if (opt.effects) segmentEditData[index].effects = opt.effects
  if (opt.optimizedShots) segmentEditData[index].optimizedShots = undefined
}

// ====== 帧图选择器状态 ======
const framePickerShow = ref(false)
const framePickerMode = ref<'firstFrame' | 'midFrame' | 'lastFrame'>('firstFrame')
const framePickerSegIdx = ref(-1)
const framePickerImages = ref<{ url: string; label: string }[]>([])

function getFramePickerImages(): { url: string; label: string }[] {
  const frames: { url: string; label: string }[] = []
  try {
    const scenes = state.workspace.scenes || []
    for (const s of scenes) { if (s?.imageUrl) frames.push({ url: s.imageUrl, label: s.name || '场景图' }) }
    const chars = state.workspace.characters || []
    for (const c of chars) { if (c?.imageUrl) frames.push({ url: c.imageUrl, label: c.name || '角色图' }) }
  } catch {}
  return frames
}

function pickFrameImage(url: string) {
  const idx = framePickerSegIdx.value
  if (idx < 0) return
  const mode = framePickerMode.value
  if (mode === 'firstFrame') segmentFirstFrameUrls.value[idx] = url
  else if (mode === 'midFrame') segmentMidFrameUrls.value[idx] = url
  else if (mode === 'lastFrame') segmentLastFrameUrls.value[idx] = url
  framePickerShow.value = false
  // 保存
  saveSegmentEditState(idx)
}

// ====== 帧图卡片：更新画面描述 ======
function updateFrameDesc(index: number, frameType: 'first' | 'mid' | 'last', value: string) {
  if (!frameDescriptions[index]) {
    frameDescriptions[index] = { first: '', mid: '', last: '' }
  }
  frameDescriptions[index][frameType] = value
}

// ====== 帧图卡片：更新图生图 prompt ======
function updateFramePrompt(index: number, frameType: 'first' | 'mid' | 'last', field: 'prompt' | 'negativePrompt', value: string) {
  if (!framePrompts[index]) {
    framePrompts[index] = { first: { prompt: '', negativePrompt: '' }, mid: { prompt: '', negativePrompt: '' }, last: { prompt: '', negativePrompt: '' } }
  }
  framePrompts[index][frameType][field] = value
}

// ====== 帧图卡片：AI优化提示词 ======
async function optimizeFramePrompt(index: number, frameType: 'first' | 'mid' | 'last') {
  if (!frameOpting[index]) frameOpting[index] = {}
  frameOpting[index][frameType] = true

  // ⭐清除旧缓存
  if (!framePrompts[index]) {
    framePrompts[index] = { first: { prompt: '', negativePrompt: '' }, mid: { prompt: '', negativePrompt: '' }, last: { prompt: '', negativePrompt: '' } }
  }
  framePrompts[index][frameType].prompt = ''
  framePrompts[index][frameType].negativePrompt = ''
  delete optimizedResults[index]

  const seg = segments.value[index]
  const data = getSegmentData(index)
  // 如果用户没填帧描述，用 narrative 代替
  let desc = frameDescriptions[index]?.[frameType] || ''
  if (!desc && seg) {
    const segData = segmentEditData[index] || seg
    desc = segData.narrative || seg.narrative || seg.fullText || ''
  }
  const key = `${index}_${frameType}`
  const charImgs = segmentCharImages[key] || []
  const sceneImgs = segmentSceneImages[key] || []
  const propImgs = segmentPropImages[key] || []

  // ⭐ 收集选中角色的详细特征（服装/外貌）— 深拷贝防止 Vue 响应式污染
  const chars = JSON.parse(JSON.stringify((state.workspace.characters || []).filter((c: any) => charImgs.includes(c.imageUrl))))
  const charDetails = chars.map((c: any) => ({
    name: c.name || '',
    costume: c.costume || '',
    appearance: c.description || c.appearance || c.personality || '',
  }))
  // ⭐ 收集选中场景的详细描述 — 同上深拷贝
  const scs = JSON.parse(JSON.stringify((state.workspace.scenes || []).filter((s: any) => sceneImgs.includes(s.imageUrl))))
  const sceneDetails = scs.map((s: any) => ({
    name: s.name || '',
    environment: s.environment || s.description || '',
  }))

  // ⭐ 获取视频风格 & 画面比例
  const { videoStyle, aspectRatio } = useStudioStore()

  try {
    const token = getAuthToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    // ⭐ 帧间继承：获取前一帧的描述和优化后的 prompt（中帧继承首帧，尾帧继承中帧）
    let prevFrameDescription = ''
    let prevFramePrompt = ''
    if (frameType === 'mid') {
      prevFrameDescription = frameDescriptions[index]?.first || ''
      prevFramePrompt = framePrompts[index]?.first?.prompt || ''
    } else if (frameType === 'last') {
      prevFrameDescription = frameDescriptions[index]?.mid || ''
      prevFramePrompt = framePrompts[index]?.mid?.prompt || ''
    }

    const requestBody = JSON.parse(JSON.stringify({
      segmentNarrative: data?.narrative || seg?.narrative || '',
      frameDescription: desc || '',
      frameType,
      prevFrameDescription,
      prevFramePrompt,
      charImages: charImgs || [],
      sceneImages: sceneImgs || [],
      propImages: propImgs || [],
      charDetails: charDetails || [],
      sceneDetails: sceneDetails || [],
      videoStyle: (typeof videoStyle === 'string' ? videoStyle : 'realistic'),
      aspectRatio: (typeof aspectRatio === 'string' ? aspectRatio : '9:16'),
    }))

    const res = await fetch('/api/ai/optimize-frame-prompt', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn('[optimizeFramePrompt] 请求失败:', res.status, errText)
      alert('AI 优化失败: ' + (errText || `HTTP ${res.status}`))
      return
    }

    const json = await res.json()
    if (json.success && json.data) {
      if (!framePrompts[index]) {
        framePrompts[index] = { first: { prompt: '', negativePrompt: '' }, mid: { prompt: '', negativePrompt: '' }, last: { prompt: '', negativePrompt: '' } }
      }
      framePrompts[index][frameType].prompt = json.data.prompt || ''
      framePrompts[index][frameType].negativePrompt = json.data.negativePrompt || ''
      alert(`✅ ${frameType === 'first' ? '首帧' : frameType === 'mid' ? '中帧' : '尾帧'}提示词已优化`)
    }
  } catch (err) {
    console.warn('[optimizeFramePrompt] error:', err)
    alert('AI 优化出错: ' + (err instanceof Error ? err.message : '未知错误'))
  } finally {
    frameOpting[index][frameType] = false
  }
}

// ====== 多图拼接工具：把多张参考图拼成一张网格图 ======
function composeReferenceGrid(urls: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const total = urls.length
    if (total === 0) return reject(new Error('无参考图'))
    if (total === 1) return resolve(urls[0])

    // 计算网格布局（最多 3x3 = 9张）
    const cols = Math.min(total >= 6 ? 3 : total >= 3 ? 2 : total, 3)
    const rows = Math.ceil(total / cols)
    const maxDim = 3 // 最大行列数

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    // 每张图片固定 400px（保持合理大小）
    const cellSize = Math.min(400, Math.floor(1200 / cols))
    canvas.width = cols * cellSize
    canvas.height = rows * cellSize

    // 填充白色背景
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    let loaded = 0
    let failed = 0

    urls.slice(0, maxDim * maxDim).forEach((rawUrl, i) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      // ⭐ 使用代理加载图片（解决火山 TOS CORS 问题）
      const proxyUrl = proxyImageUrl(rawUrl)
      img.onload = () => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = col * cellSize
        const y = row * cellSize
        // 按比例缩放填充
        const scale = Math.max(cellSize / img.width, cellSize / img.height)
        const sw = img.width * scale
        const sh = img.height * scale
        const sx = x + (cellSize - sw) / 2
        const sy = y + (cellSize - sh) / 2
        ctx.drawImage(img, sx, sy, sw, sh)
        // 加边框
        ctx.strokeStyle = '#e0e0e0'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, cellSize, cellSize)
        loaded++
        if (loaded + failed >= Math.min(total, maxDim * maxDim)) {
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
      }
      img.onerror = () => {
        failed++
        if (loaded + failed >= Math.min(total, maxDim * maxDim)) {
          // 如果至少有一张成功，返回拼接结果；否则降级
          if (loaded > 0) {
            resolve(canvas.toDataURL('image/jpeg', 0.85))
          } else {
            reject(new Error('所有参考图加载失败'))
          }
        }
      }
      img.src = proxyUrl
    })
  })
}

// ====== 帧图卡片：图生图生成 ======
async function generateFrameImage(index: number, frameType: 'first' | 'mid' | 'last') {
  if (!frameGenning[index]) frameGenning[index] = {}
  frameGenning[index][frameType] = true

  // ⭐ 收集勾选的参考图
  const charKey = `${index}_${frameType}`
  const selectedChars = segmentCharImages[charKey] || []
  const selectedScenes = segmentSceneImages[charKey] || []
  const selectedProps = segmentPropImages[charKey] || []
  const allRefs = [...selectedChars, ...selectedScenes, ...selectedProps].filter(Boolean)

  // ⭐ 帧间继承：中帧自动引用首帧结果图，尾帧自动引用中帧结果图
  let prevFrameUrl = ''
  if (frameType === 'mid') {
    prevFrameUrl = segmentFirstFrameUrls.value[index] || ''
  } else if (frameType === 'last') {
    prevFrameUrl = segmentMidFrameUrls.value[index] || ''
  }
  // 上一帧结果图作为主参考图，锁定角色/场景/风格一致性
  const refsWithInherit = prevFrameUrl ? [prevFrameUrl, ...allRefs] : allRefs
  let referenceImage = refsWithInherit[0] || ''
  const mode = referenceImage ? 'img2img' : 'txt2img'

  // ⭐ 多张参考图拼接成一张网格图（保证所有图都被模型看到）
  // 前帧结果图作为主参考图锁定一致性，角色/场景/道具图拼成副图辅助
  if (prevFrameUrl) {
    // 前帧图优先做主参考，其他角色/场景/道具图拼成副图提交
    referenceImage = prevFrameUrl
    if (allRefs.length > 1) {
      try {
        referenceImage = await composeReferenceGrid([prevFrameUrl, ...allRefs])
      } catch (e) {
        console.warn('[generateFrameImage] 拼图失败，降级为前帧图:', e)
        referenceImage = prevFrameUrl
      }
    } else if (allRefs.length === 1) {
      // 有前帧图+1张参考图：也拼一下
      try {
        referenceImage = await composeReferenceGrid([prevFrameUrl, ...allRefs])
      } catch (e) {}
    }
  } else if (allRefs.length > 1) {
    // 首帧：多张角色/场景/道具图拼成网格
    try {
      referenceImage = await composeReferenceGrid(allRefs)
    } catch (e) {
      console.warn('[generateFrameImage] 拼图失败，降级为第一张:', e)
    }
  }

  // ⭐ 获取选中角色的详细特征
  const chars = (state.workspace.characters || []).filter((c: any) => selectedChars.includes(c.imageUrl))
  const scenes = (state.workspace.scenes || []).filter((s: any) => selectedScenes.includes(s.imageUrl))
  const segData = getSegmentData(index) || {}
  const frameDesc = frameDescriptions[index]?.[frameType] || segData.narrative || ''

  // ⭐ 结构化模板组装 prompt
  const charSection = chars.map((c: any, i: number) =>
    `[角色${i + 1}: ${c.name || ''}]\n` +
    `  服装（禁止修改）: ${c.costume || '同上'}\n` +
    `  外貌: ${c.description || c.appearance || ''}\n` +
    `  表情: ${segData.emotion || '正常'}\n`
  ).join('\n')

  const sceneSection = scenes.map((s: any, i: number) =>
    `[场景${i + 1}: ${s.name || ''}]\n` +
    `  环境: ${s.environment || s.description || ''}\n`
  ).join('\n')

  // ⭐ 帧间连续性描述
  const prevFrameHint = prevFrameUrl
    ? `\n【帧间连续性】\n本次生成将引用上一帧结果图作为主要参考图，确保角色外貌、服装、场景色调在帧间保持一致。\n注意：${frameType === 'mid' ? '首帧是背面拍摄，中帧需要改为正面拍摄' : '中帧是正面拍摄，尾帧需要改为远景拍摄'}，请在保持角色一致的前提下调整拍摄角度。\n`
    : ''

  // ⭐ 获取视频风格 & 画面比例
  const { videoStyle, aspectRatio } = useStudioStore()

  const structuredPrompt = [
    `[固定模板] 帧图画面生成指令 — 严格按照以下结构化字段生成，禁止在上述角色服装上做任何修改。`,
    ``,
    `【角色】`,
    charSection || `[无选中角色]`,
    ``,
    `【场景】`,
    sceneSection || `[无选中场景]`,
    ``,
    `【帧画面描述】`,
    frameDesc,
    ``,
    prevFrameHint,
    `【参数控制（严格按照以下字段执行）】`,
    `- 表情: 根据帧描述中的情绪，精确描绘角色面部表情`, // emotion
    `- 动作: 根据帧描述中的动作描述`, // action from frameDesc
    `- 镜头: 中景`,
    `- 光线: 自然光`,
    `- 风格: cinematic lighting, photorealistic, 8k`,
    ``,
    `【禁止事项】`,
    `- 不得修改角色的服装/外貌（以上述服装描述为准）`,
    `- 不得直接复制参考图的面部表情，必须根据帧描述微调`,
    `- 场景内容以场景环境描述为准，参考图仅提供氛围参考`,
    ``,
  ].join('\n')

  // 如果用户手动编辑了 prompt，优先使用用户编辑版本作为补充
  const userPrompt = framePrompts[index]?.[frameType]?.prompt || ''
  const finalPrompt = userPrompt
    ? structuredPrompt + '\n\n[用户补充]\n' + userPrompt
    : structuredPrompt

  const finalNegative = framePrompts[index]?.[frameType]?.negativePrompt || ''

  // 结构化 prompt:

  try {
    const token = getAuthToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    // ⭐ 画面比例 → 像素尺寸映射
    const ratioStr = (typeof aspectRatio === 'string' ? aspectRatio : '9:16')
    const sizeMap: Record<string, string> = {
      '9:16': '1080x1920',
      '16:9': '1920x1080',
      '1:1': '1920x1920',
      '4:3': '1920x1440',
      '3:4': '1440x1920',
    }
    const genSize = sizeMap[ratioStr] || '1920x1920'

    const submitRes = await fetch('/api/tasks/ai-generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: projectId.value,
        taskType: 'image',
        input: {
          prompt: finalPrompt,
          negativePrompt: finalNegative,
          mode,
          imageUrl: referenceImage,
          referenceImages: [referenceImage].filter(Boolean),  // 已拼接为单张网格图
          source: 'frame_' + frameType,
          name: `帧图_${index + 1}_${frameType}`,
          aspectRatio: ratioStr,
          size: genSize,  // ⭐ 传给 adapter 的像素尺寸，如 1080x1920
        },
      }),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text().catch(() => '')
      console.warn('[generateFrameImage] 提交任务失败:', submitRes.status, errText)
      return
    }

    const submitData = await submitRes.json()
    const taskId = submitData?.task?.id
    if (!taskId) {
      console.warn('[generateFrameImage] 未获取到任务 ID')
      return
    }

    // 轮询等待任务完成（最长 60 秒）
    let imageUrl = ''
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const statusRes = await fetch(`/api/tasks/${taskId}/status`, { headers })
      if (!statusRes.ok) continue
      const statusData = await statusRes.json()
      const task = statusData?.task
      if (!task) continue
      if (task.status === 'completed') {
        const result = task.result || {}
        imageUrl = result?.data?.imageUrl || result?.data?.url || result?.imageUrl || result?.url || ''
        try {
          const err = JSON.parse(task.error || '{}')
          imageUrl = imageUrl || err?.output?.imageUrl || err?.output?.url || ''
        } catch {}
        break
      }
      if (task.status === 'failed') {
        console.warn('[generateFrameImage] 任务失败:', task.error)
        break
      }
    }

    if (imageUrl) {
      // 更新对应的帧图 URL
      if (frameType === 'first') {
        segmentFirstFrameUrls.value[index] = imageUrl
      } else if (frameType === 'mid') {
        segmentMidFrameUrls.value[index] = imageUrl
      } else if (frameType === 'last') {
        segmentLastFrameUrls.value[index] = imageUrl
      }
      // 保存到 DB
      saveSegmentEditState(index)
    }
  } catch (err) {
    console.warn('[generateFrameImage] error:', err)
  } finally {
    frameGenning[index][frameType] = false
  }
}

// ====== 生成首中尾帧图 ======
async function generateThreeFrames(idx: number) {
  const seg = segments.value[idx]
  if (!seg) return

  generatingFrames.value[idx] = true
  const segData = getSegmentData(idx)
  const narrative = segData.narrative || ''
  const dialogue = segData.dialogue || ''
  const effects = segData.effects || ''
  const duration = segData.duration || 8

  // 构造三段 prompt
  const firstPrompt = `生成视频的第0秒首帧画面。剧情描述开头：${narrative.split('\\n')[0] || narrative.substring(0, 100)}`
  const midSecond = Math.floor(duration / 2)
  const lastSecond = duration - 1

  // 中帧 prompt：提取剧情描述中 midpoint 附近的文字
  const narrativeLines = narrative.split('\n')
  const midLine = narrativeLines.find((l: string) => l.includes(`[${midSecond}s`) || l.includes(`${midSecond}`)) || `第${midSecond}秒附近：${narrative.substring(narrative.length * 0.3, narrative.length * 0.7).substring(0, 120)}`
  const lastLine = narrativeLines.slice().reverse().find((l: string) => l.includes(`[${lastSecond}s`) || l.includes(`${lastSecond}`)) || `结尾：${narrative.substring(narrative.length * 0.7).substring(0, 100)}`

  const midPrompt = `生成视频的第${midSecond}秒中帧画面。此时剧情：${midLine}`
  const lastPrompt = `生成视频的最后一秒（第${lastSecond}秒）尾帧画面。此时剧情：${lastLine}`

  // 引用图（角色+场景+道具）
  const refImgs: string[] = [
    ...(segmentCharImages[idx] || []),
    ...(segmentSceneImages[idx] || []),
    ...(segmentPropImages[idx] || []),
  ].filter(Boolean)

  const token = getAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    // 并发生成三帧
    const results = await Promise.all([
      // 首帧
      fetch('/api/tasks/ai-generate', {
        method: 'POST', headers,
        body: JSON.stringify({
          projectId: projectId.value, taskType: 'image',
          input: {
            prompt: firstPrompt, referenceImages: refImgs,
            negativePrompt: '扭曲、异常肢体、多指、面部变形',
            size: '1080x1920', n: 1, temperature: 0.5,
          },
        }),
      }),
      // 中帧
      fetch('/api/tasks/ai-generate', {
        method: 'POST', headers,
        body: JSON.stringify({
          projectId: projectId.value, taskType: 'image',
          input: {
            prompt: midPrompt, referenceImages: refImgs,
            negativePrompt: '扭曲、异常肢体、多指、面部变形',
            size: '1080x1920', n: 1, temperature: 0.5,
          },
        }),
      }),
      // 尾帧
      fetch('/api/tasks/ai-generate', {
        method: 'POST', headers,
        body: JSON.stringify({
          projectId: projectId.value, taskType: 'image',
          input: {
            prompt: lastPrompt, referenceImages: refImgs,
            negativePrompt: '扭曲、异常肢体、多指、面部变形',
            size: '1080x1920', n: 1, temperature: 0.5,
          },
        }),
      }),
    ])

    const finalUrls: string[] = []
    for (let ri = 0; ri < results.length; ri++) {
      const res = results[ri]
      if (!res.ok) continue
      const json = await res.json()
      const taskId = json.task?.id || json.data?.taskId || ''
      if (!taskId) continue

      // 轮询等待图片生成完成
      for (let poll = 0; poll < 30; poll++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const pollRes = await fetch(`/api/tasks/${taskId}/status`, { headers })
          if (!pollRes.ok) continue
          const pollJson = await pollRes.json()
          const task = pollJson.task || pollJson.data
          if (!task) continue
          if (task.status === 'completed' || task.status === 'success') {
            const url = task.result?.url || task.result?.imageUrl || ''
            if (url) finalUrls[ri] = url
            break
          }
          if (task.status === 'failed' || task.status === 'error') break
        } catch {}
      }
    }

    // 更新三帧 URL
    if (finalUrls[0]) segmentFirstFrameUrls.value[idx] = finalUrls[0]
    if (finalUrls[1]) segmentMidFrameUrls.value[idx] = finalUrls[1]
    if (finalUrls[2]) segmentLastFrameUrls.value[idx] = finalUrls[2]
  } catch (err) {
    console.warn('[generateThreeFrames] ❌ error:', err)
  } finally {
    generatingFrames.value[idx] = false
    // 三帧都生成完后保存
    saveSegmentEditState(idx)
  }
}

// ====== 视频生成（带缓存清理） ======
async function generateCurrentVideo() {
  if (selectedSegmentIndex.value < 0) return
  const seg = segments.value[selectedSegmentIndex.value]
  if (!seg) return

  const idx = selectedSegmentIndex.value

  // ⭐ 清除旧缓存：视频结果 + 后端的 provider_state 安全护栏缓存
  generatedVideos.value[idx] = ''
  console.log('[generateCurrentVideo] 🧹 已清除旧视频缓存')

  generatingVideo.value = true

  const data = getSegmentData(idx)

  const token = getAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const voiceMap: Record<string, string> = {}
  for (const v of voiceUrls.value) {
    if (v.url) voiceMap[v.characterName] = v.url
  }

  try {
    // ⭐ 调用后端清理端点，清除 provider_state 等安全护栏缓存
    try {
      await fetch('/api/provider-cache/cleanup?type=video', { method: 'POST', headers })
      console.log('[generateCurrentVideo] 🧹 已清理后端缓存')
    } catch (_) {
      // 非关键步骤，不影响主流程
    }

    // ⭐ 提交三帧图 + 本片段勾选的角色图（保证多角色形象一致性）
    const firstUrl = segmentFirstFrameUrls.value[idx] || ''
    const midUrl = segmentMidFrameUrls.value[idx] || ''
    const lastUrl = segmentLastFrameUrls.value[idx] || ''

    // 收集本片段勾选的角色图（从 segmentCharImages 取，已通过 toggleCharImage 勾选）
    const charRefUrls: string[] = (segmentCharImages[`${idx}_first`] || [])
      .concat(segmentCharImages[`${idx}_mid`] || [])
      .concat(segmentCharImages[`${idx}_last`] || [])
      .filter((url: string, i: number, arr: string[]) => url && arr.indexOf(url) === i) // 去重

    const firstDesc = frameDescriptions[idx]?.first || data.narrative || ''
    const midDesc = frameDescriptions[idx]?.mid || ''
    const lastDesc = frameDescriptions[idx]?.last || ''

    // ⭐ 收集 AI 优化的逐秒镜头脚本（如果有）
    const optResult = optimizedResults[idx]
    const optimizedShots = optResult?.optimizedShots || []

    const res = await fetch('/api/tasks/ai-generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: projectId.value,
        taskType: 'video',
        input: {
          narrative: data.narrative || '',
          dialogue: data.dialogue || '',
          effects: data.effects || '',
          optimizedShots,  // ⭐ 逐秒镜头脚本：包含 camera/action/expression 等运镜信息
          negativePrompt: data.negativePrompt || '',
          segmentIndex: String(idx),
          segmentId: seg.id || seg.segmentId,
          duration: segmentDuration[idx] || data.duration || 8,
          ratio: '9:16',
          firstFrameUrl: firstUrl,
          midFrameUrl: midUrl,
          lastFrameUrl: lastUrl,
          firstFrameDescription: firstDesc,
          midFrameDescription: midDesc,
          lastFrameDescription: lastDesc,
          characterReferenceUrls: charRefUrls.length > 0 ? charRefUrls : undefined,
          voiceMap,
          model: selectedVideoModel.value,
          videoStyle: (typeof videoStyle === 'string' ? videoStyle : 'realistic'),
        },
      }),
    })

    const json = await res.json()
    if (!json.success) {
      console.warn('[generateCurrentVideo] ❌ 提交失败:', json.error)
      return
    }

    const taskId: string = json.task?.id || json.data?.taskId || ''
    if (!taskId) {
      console.warn('[generateCurrentVideo] ❌ 无任务 ID:', json)
      return
    }

    console.log('[generateCurrentVideo] ✅ 视频任务已提交:', taskId)

    // 轮询任务状态（最长 240 秒）
    const maxPolls = 240
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, 1000))
      try {
        const statusRes = await fetch(`/api/tasks/${taskId}/status`, { headers })
        const statusJson = await statusRes.json()
        const task = statusJson.task || statusJson.data
        if (!task) continue
        const status = task.status || ''
        console.log(`[generateCurrentVideo] ⏳ 轮询 ${i + 1}s: status=${status}`)
        if (status === 'completed' || status === 'success') {
          const result = task.result || {}
          const videoUrl = result?.url || result?.videoUrl || ''
          if (videoUrl) {
            generatedVideos.value[idx] = videoUrl
            console.log('[generateCurrentVideo] ✅ 视频生成完成:', videoUrl)
            // 保存到 DB
            saveSegmentEditState(idx)
            // ⭐ 自动滚动到视频播放区域
            setTimeout(() => {
              const videoEl = document.querySelector('.generated-video-section video')
              if (videoEl) {
                videoEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
                // 触发生成完成事件（让父组件刷新）
                window.dispatchEvent(new CustomEvent('video-generation-complete', {
                  detail: { idx, videoUrl }
                }))
              }
            }, 500)
          }
          break
        }
        if (status === 'failed' || status === 'error') {
          console.warn('[generateCurrentVideo] ❌ 视频生成失败:', task.error)
          break
        }
      } catch (err) {
        console.warn('[generateCurrentVideo] ⚠️ 轮询出错:', err)
      }
    }
  } catch (err) {
    console.warn('[generateCurrentVideo] ❌ error:', err)
  } finally {
    generatingVideo.value = false
  }
}

async function goToNextStage() {
  // 确保 videoSegments 数据保存到 store
  const segmentsData = segments.value.map((seg: any, i: number) => {
    const data = getSegmentData(i)
    return {
      segmentId: seg.id || seg.segmentId,
      narrative: data.narrative,
      dialogue: data.dialogue,
      effects: data.effects,
      charImages: segmentCharImages[i] || [],
      sceneImages: segmentSceneImages[i] || [],
      propImages: segmentPropImages[i] || [],
    }
  })

  // 如果有优化结果，同步到 store
  for (let i = 0; i < segments.value.length; i++) {
    if (optimizedResults[i]) {
      const opt = optimizedResults[i]
      const narrative = state.workspace.narrative || {}
      if (opt.dialogue && narrative) {
        // 将优化后的对话同步到 narrative.dialogues
        const seg = segments.value[i]
        if (seg) {
          narrative.dialogues = narrative.dialogues || []
          // 避免重复
          const existingIdx = narrative.dialogues.findIndex(
            (d: any) => d.segmentId === seg.id || d.segmentId === seg.segmentId
          )
          const dialogueEntry = { segmentId: seg.id || seg.segmentId, dialogue: opt.dialogue }
          if (existingIdx >= 0) {
            narrative.dialogues[existingIdx] = dialogueEntry
          } else {
            narrative.dialogues.push(dialogueEntry)
          }
          state.workspace.narrative = narrative
        }
      }
    }
  }

  // ⭐ 将优化结果持久化到 executionResults 并保存到服务器
  const executionResults = state.workspace.narrative?.executionResults || {}
  // 收集所有片段的优化结果
  const allOptimizedResults: Record<number, any> = {}
  for (let i = 0; i < segments.value.length; i++) {
    if (optimizedResults[i]) {
      allOptimizedResults[i] = optimizedResults[i]
    }
  }
  if (Object.keys(allOptimizedResults).length > 0) {
    executionResults.optimizedResults = allOptimizedResults
  }
  // 收集编辑数据作为 shotOptimizations
  const shotOptimizations: Record<number, any> = {}
  for (let i = 0; i < segments.value.length; i++) {
    shotOptimizations[i] = {
      narrative: segmentEditData[i]?.narrative || '',
      dialogue: segmentEditData[i]?.dialogue || '',
      effects: segmentEditData[i]?.effects || '',
    }
  }
  executionResults.shotOptimizations = shotOptimizations

  state.workspace.narrative = state.workspace.narrative || {}
  state.workspace.narrative.executionResults = executionResults

  // 调用 saveToServer 回写服务器
  try {
    const token = getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const pid = projectId.value
    if (pid) {
      await fetch(`/api/executions/${pid}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          executionResults,
        }),
      })
    }
  } catch (err) {
    console.warn('[VideoGeneration] saveToServer error:', err)
  }

  goToStage('voice-generation')
}

/** 拖放素材到卡片列表区域 */
function onAssetDrop(event: DragEvent) {
  const assetData = event.dataTransfer?.getData('text/asset')
  if (!assetData) return
  try {
    const asset = JSON.parse(assetData) as { id: string; type: string; url?: string; prompt?: string }
    // 将素材信息填入当前选中或第一个片段
    const targetIdx = selectedSegmentIndex.value >= 0 ? selectedSegmentIndex.value : 0
    if (targetIdx < segments.value.length) {
      const segData = getSegmentData(targetIdx)
      // 按素材类型填充不同字段
      const type = asset.type || ''
      if (type === 'character' || type === 'scene') {
        // 角色/场景 → 填充 narrative
        if (asset.prompt && !segData.narrative) {
          updateSegmentField(targetIdx, 'narrative', asset.prompt)
        }
        if (asset.url) {
          // 保存参考图 URL
          updateSegmentField(targetIdx, 'referenceUrl', asset.url)
        }
      } else if (type === 'storyboard') {
        // 分镜图 → 存为参考
        if (asset.url) {
          updateSegmentField(targetIdx, 'storyboardUrl', asset.url)
        }
      } else {
        // 其他素材 → 填入 narrative（描述）
        if (asset.prompt && !segData.narrative) {
          updateSegmentField(targetIdx, 'narrative', asset.prompt)
        }
      }
    }
  } catch (err) {
    console.warn('[VideoGeneration] asset drop parse error:', err)
  }
}

function onDragOver(_event: DragEvent) {
  // 阻止默认，允许放置
}

// ====== 视频合成拼接 ======
const mergeState = reactive({
  merging: false,
  status: null as string | null,
  outputUrl: null as string | null,
  error: null as string | null,
  pollTimer: null as ReturnType<typeof setInterval> | null,
})

async function checkMergeEligibility() {
  try {
    const res = await fetch(`/api/video/merge/check/${projectId.value}`, {
      headers: { 'Authorization': `Bearer ${useToken()}` },
    })
    const json = await res.json()
    return json?.data
  } catch (e: any) {
    console.warn('[VideoMerge] 检查失败:', e.message)
    return null
  }
}

async function mergeVideos() {
  if (mergeState.merging) return

  // 先检查是否具备合并条件
  const eligibility = await checkMergeEligibility()
  if (!eligibility) {
    window.alert('无法检查视频合成条件，请重试')
    return
  }
  if (eligibility.totalSegments === 0) {
    window.alert('项目尚未生成任何视频段')
    return
  }
  if (eligibility.readySegments === 0) {
    // 检测是否只有一帧但未生成视频
    const segmentCount = eligibility.totalSegments
    window.alert(`暂无已生成的视频（共 ${segmentCount} 段），请先生成视频再合成`)

    return
  }
  if (eligibility.missingSegments.length > 0) {
    const ok = window.confirm(
      `尚有 ${eligibility.missingSegments.length} 段未生成视频，仅对已生成的 ${eligibility.readySegments} 段进行拼接，是否继续？`
    )
    if (!ok) return
  }

  mergeState.merging = true
  mergeState.status = 'processing'
  mergeState.error = null
  mergeState.outputUrl = null

  try {
    const res = await fetch(`/api/video/merge/${projectId.value}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${useToken()}`,
      },
      body: JSON.stringify({
        includeTTS: false,
        includeSubtitles: false,
        transitionType: 'none',
      }),
    })
    const json = await res.json()
    if (!json.success) {
      mergeState.status = 'failed'
      mergeState.error = json.message || '合成提交失败'
      mergeState.merging = false
      return
    }

    // 开始轮询合成状态
    mergeState.pollTimer = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/video/merge/status/${projectId.value}`, {
          headers: { 'Authorization': `Bearer ${useToken()}` },
        })
        const statusJson = await statusRes.json()
        const data = statusJson?.data

        if (!data) return

        mergeState.status = data.mergeStatus

        if (data.mergeStatus === 'done') {
          mergeState.outputUrl = data.outputUrl
          mergeState.merging = false
          if (mergeState.pollTimer) {
            clearInterval(mergeState.pollTimer)
            mergeState.pollTimer = null
          }
          window.alert('✅ 视频合成完成！')
        } else if (data.mergeStatus === 'failed') {
          mergeState.merging = false
          mergeState.error = '合成失败'
          if (mergeState.pollTimer) {
            clearInterval(mergeState.pollTimer)
            mergeState.pollTimer = null
          }
          window.alert('❌ 视频合成失败，请查看日志')
        }
      } catch (e: any) {
        console.warn('[VideoMerge] 轮询失败:', e.message)
      }
    }, 3000) // 每 3 秒轮询一次

  } catch (e: any) {
    mergeState.status = 'failed'
    mergeState.error = e.message
    mergeState.merging = false
  }
}

// 在组件卸载时清理定时器
import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (mergeState.pollTimer) {
    clearInterval(mergeState.pollTimer)
    mergeState.pollTimer = null
  }
})

function useToken() {
  // 从存储中获取 token
  return localStorage.getItem('access_token') || ''
}
</script>

<style scoped>
.duration-slider {
  width: 100%;
  margin: 4px 0;
  accent-color: #4f46e5;
}
.duration-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #888;
  margin-top: -4px;
}
/* ====== 整体布局 ====== */
.video-workspace-rework {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0d0d18;
  color: #d1d5db;
}

.workspace-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #1a1a28;
  flex-shrink: 0;
  background: #0d0d18;
}

.toolbar-title {
  font-size: 13px;
  font-weight: 600;
  color: #d1d5db;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.btn-merge {
  background: linear-gradient(135deg, #059669, #10b981);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.2s;
}

.btn-merge:hover:not(:disabled) {
  background: linear-gradient(135deg, #047857, #059669);
}

.btn-merge:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-next {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.btn-next:hover {
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
}

/* ====== 主体 ====== */
.workspace-body {
  flex: 1;
  display: grid;
  grid-template-columns: 420px 1fr;
  overflow: hidden;
}

/* ====== 中间栏 ====== */
.center-panel {
  overflow-y: auto;
  border-right: 1px solid #1a1a28;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 0;
  background: #0d0d18;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ====== 视频生成卡片 ====== */
.video-card {
  background: #1a1a28;
  border: 1px solid #2a2a3a;
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.video-card:hover {
  border-color: #3b82f6;
}

.video-card.active {
  border-color: #3b82f6;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.15);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #1a1a28;
}

.card-title {
  font-size: 11px;
  font-weight: 600;
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.card-seg-title {
  font-size: 11px;
  color: #6b7280;
}

/* ====== 输入框字段 ====== */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 10px;
  color: #9ca3af;
  font-weight: 500;
}

.field-input {
  background: #0d0d18;
  border: 1px solid #2a2a3a;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 11px;
  color: #d1d5db;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.field-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.field-input::placeholder {
  color: #4b5563;
}

.field-input.narrative {
  min-height: 60px;
}

.field-input.dialogue {
  min-height: 44px;
}

.field-input.effects {
  min-height: 44px;
}

/* ====== AI 优化按钮 ====== */
.btn-optimize {
  background: linear-gradient(135deg, #065f46, #059669);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  width: 100%;
  transition: opacity 0.2s;
}

.btn-optimize:hover:not(:disabled) {
  background: linear-gradient(135deg, #047857, #10b981);
}

.btn-optimize:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ====== 引用区域 ====== */
.ref-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid #1a1a28;
}

.ref-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ref-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 500;
}

.ref-images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ref-image-item {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.2s;
  background: #0d0d18;
}

.ref-image-item:hover {
  border-color: #4b5563;
}

.ref-image-item.selected {
  border-color: #3b82f6;
}

.ref-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ref-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  font-size: 7px;
  color: #fff;
  background: rgba(0, 0, 0, 0.7);
  padding: 1px 3px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.check-mark {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #3b82f6;
  color: #fff;
  font-size: 8px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ref-empty {
  font-size: 10px;
  color: #4b5563;
  font-style: italic;
}

.ref-voices {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.voice-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.voice-name {
  font-size: 10px;
  color: #9ca3af;
  min-width: 50px;
}

.voice-player {
  height: 28px;
  width: 160px;
}

/* 角色参考图复选框行 */
.ref-chars {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.char-check-item {
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  padding: 2px 6px 2px 2px;
  border: 1px solid #2a2a3e;
  border-radius: 6px;
  background: #12121e;
  transition: border-color 0.15s, background 0.15s;
}
.char-check-item:hover {
  border-color: #4b5563;
  background: #1a1a2a;
}
.char-check-thumb {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid transparent;
}
.char-check-thumb-empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: #1a1a2e;
  border: 1px dashed #3b82f6;
  color: #6b7280;
  cursor: default;
}
.ref-thumb-wrapper {
  position: relative;
  display: inline-flex;
}
.ref-thumb-wrapper:hover .ref-replace-btn {
  opacity: 1;
}
.ref-replace-btn {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 18px;
  height: 18px;
  font-size: 10px;
  line-height: 18px;
  text-align: center;
  border: 1px solid #3b82f6;
  border-radius: 50%;
  background: #1e293b;
  color: #93c5fd;
  cursor: pointer;
  padding: 0;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 2;
}
.ref-replace-btn:hover {
  background: #3b82f6;
  color: #fff;
}
.char-check-thumb.selected {
  border-color: #3b82f6;
}
.char-checkbox {
  width: 12px;
  height: 12px;
  accent-color: #3b82f6;
  cursor: pointer;
}
.char-check-name {
  font-size: 9px;
  color: #9ca3af;
  max-width: 50px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.char-check-character {
  font-size: 8px;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
  padding: 0 4px;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 16px;
}
.ref-hint {
  font-size: 9px;
  color: #4b5563;
  font-weight: normal;
}

/* ====== 分割线 ====== */
.divider {
  height: 2px;
  background: linear-gradient(90deg, transparent, #3b82f6, #10b981, transparent);
  margin: 36px 8px 8px;
  border-radius: 1px;
}

/* ====== 音色生成区域 ====== */
/* ====== 右侧栏 ====== */
.right-panel {
  overflow-y: auto;
  padding: 16px;
  background: #0d0d18;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
}

.empty-icon {
  font-size: 40px;
  opacity: 0.2;
}

.empty-text {
  font-size: 12px;
  color: #4b5563;
}

/* ====== 选中片段详情 ====== */
.segment-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-title {
  font-size: 13px;
  font-weight: 600;
  color: #d1d5db;
}

.btn-generate-video {
  background: linear-gradient(135deg, #059669, #10b981);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 7px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.2s;
}

.btn-generate-video:hover {
  opacity: 0.9;
}

.btn-optimize-video-prompt {
  background: linear-gradient(135deg, #7c3aed, #a78bfa);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 7px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.2s;
}
.btn-optimize-video-prompt:hover {
  opacity: 0.9;
}
.btn-optimize-video-prompt:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ====== AIGC 可编辑表单 ====== */
.aigc-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #1a1a28;
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  padding: 12px;
}

.aigc-form .field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aigc-form .field-label {
  font-size: 10px;
  color: #9ca3af;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.aigc-form .field-input {
  background: #111827;
  border: 1px solid #374151;
  border-radius: 6px;
  color: #e5e7eb;
  font-size: 11px;
  padding: 6px 8px;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s;
}

.aigc-form .field-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px rgba(59,130,246,0.3);
}

/* ====== AI 优化参考（只读） ====== */
.opt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px;
}

.opt-header-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-apply-opt {
  background: transparent;
  border: 1px solid #374151;
  color: #60a5fa;
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-apply-opt:hover {
  background: #1e3a5f;
  border-color: #3b82f6;
}

/* ====== 优化结果 ====== */
.optimized-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.opt-section {
  background: #1a1a28;
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  padding: 12px;
}

.opt-label {
  font-size: 10px;
  color: #3b82f6;
  font-weight: 600;
  margin-bottom: 6px;
}

.opt-text {
  font-size: 10px;
  color: #9ca3af;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
  font-family: inherit;
}

.empty-optimize {
  text-align: center;
  padding: 40px 0;
}

/* ====== 逐秒镜头设计 ====== */
.shots-timeline {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shots-timeline-header {
  font-size: 11px;
  font-weight: 600;
  color: #10b981;
  margin-bottom: 4px;
}

.shot-item {
  display: flex;
  gap: 8px;
  background: #1a1a28;
  border: 1px solid #2a2a3a;
  border-radius: 6px;
  padding: 8px;
}

.shot-second {
  font-size: 11px;
  font-weight: 700;
  color: #3b82f6;
  min-width: 30px;
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
}

.shot-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.shot-detail {
  font-size: 10px;
  color: #9ca3af;
  line-height: 1.5;
}

.shot-label {
  color: #6b7280;
  font-weight: 500;
}

/* ====== 视频预览 ====== */
.generated-video-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gen-label {
  font-size: 11px;
  font-weight: 600;
  color: #d1d5db;
}

.preview-video {
  width: 100%;
  max-height: 300px;
  border-radius: 8px;
  background: #000;
}

/* ====== 滚动条 ====== */
.center-panel::-webkit-scrollbar,
.right-panel::-webkit-scrollbar {
  width: 6px;
}

.center-panel::-webkit-scrollbar-track,
.right-panel::-webkit-scrollbar-track {
  background: #0d0d18;
}

.center-panel::-webkit-scrollbar-thumb,
.right-panel::-webkit-scrollbar-thumb {
  background: #2a2a3a;
  border-radius: 3px;
}

.center-panel::-webkit-scrollbar-thumb:hover,
.right-panel::-webkit-scrollbar-thumb:hover {
  background: #3a3a4a;
}

/* ====== 引用图替换样式 ====== */
.ref-selected-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.ref-thumb-sm {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #374151;
}

.btn-ref-replace {
  background: transparent;
  border: 1px solid #374151;
  color: #60a5fa;
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-ref-replace:hover {
  background: #1e3a5f;
  border-color: #3b82f6;
}

/* ====== 图片选择器弹窗 ====== */
.picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.picker-dialog {
  background: #1a1a28;
  border: 1px solid #2a2a3a;
  border-radius: 12px;
  padding: 16px;
  max-width: 480px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.picker-title {
  font-size: 13px;
  font-weight: 600;
  color: #d1d5db;
}

.picker-close {
  background: transparent;
  border: none;
  color: #6b7280;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.picker-close:hover {
  color: #ef4444;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.picker-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 6px;
  transition: border-color 0.2s;
}

.picker-item:hover {
  border-color: #3b82f6;
  background: #111827;
}

.picker-thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 6px;
}

.picker-label {
  font-size: 10px;
  color: #9ca3af;
  text-align: center;
  word-break: break-all;
  line-height: 1.3;
}

.picker-empty {
  color: #6b7280;
  font-size: 12px;
  text-align: center;
  padding: 20px 0;
}

/* ====== 生成帧图按钮 ====== */
.btn-generate-frames {
  margin-top: 10px;
  width: 100%;
  background: #1e3a5f;
  border: 1px solid #3b82f6;
  color: #60a5fa;
  padding: 8px 0;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-generate-frames:hover {
  background: #1e40af;
  color: #fff;
}

.btn-generate-frames:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ====== 三帧图卡片布局 ====== */
.frame-cards-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.frame-card {
  flex: 1;
  min-width: 0;
  background: #1e1e2e;
  border: 1px solid #2a2a3e;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.frame-card-header {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
  text-align: center;
  padding-bottom: 6px;
  border-bottom: 1px solid #2a2a3e;
}

.frame-preview-area {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 6px;
  overflow: hidden;
  background: #111;
  display: flex;
  align-items: center;
  justify-content: center;
}

.frame-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.frame-preview-empty {
  color: #4a4a5a;
  font-size: 11px;
}

.frame-field-label {
  font-size: 10px;
  font-weight: 500;
  color: #9ca3af;
  margin-top: 2px;
}

.frame-field-input {
  width: 100%;
  background: #111827;
  border: 1px solid #2d3748;
  border-radius: 6px;
  color: #d1d5db;
  font-size: 11px;
  padding: 6px 8px;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}

.frame-field-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.frame-field-input.prompt {
  font-size: 10px;
  font-family: monospace;
}

.frame-field-input.neg {
  color: #f87171;
}

.frame-refs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.frame-ref-label {
  font-size: 10px;
  color: #6b7280;
}

.frame-ref-thumbs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  max-height: 40px;
  overflow-y: auto;
}

.frame-ref-thumb {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border 0.15s, opacity 0.15s;
  opacity: 0.6;
}
.frame-ref-thumb.selected {
  border-color: #3b82f6;
  opacity: 1;
}
.frame-ref-thumb:hover {
  opacity: 0.85;
}

.ref-hint {
  font-size: 11px;
  color: #6b7280;
  font-weight: normal;
}

.frame-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.btn-opt-prompt {
  flex: 1;
  background: #1e3a5f;
  border: 1px solid #3b82f6;
  color: #60a5fa;
  padding: 6px 0;
  border-radius: 6px;
  font-size: 10px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-opt-prompt:hover {
  background: #1e40af;
  color: #fff;
}

.btn-opt-prompt:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-img2img {
  flex: 1;
  background: #3b1f3b;
  border: 1px solid #a855f7;
  color: #c084fc;
  padding: 6px 0;
  border-radius: 6px;
  font-size: 10px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-img2img:hover {
  background: #581c58;
  color: #fff;
}

.btn-img2img:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ====== AIGC 编辑卡片（常开） ====== */
.collapse-section {
  background: #1e1e2e;
  border: 1px solid #2a2a3e;
  border-radius: 10px;
  padding: 8px 12px;
}

.collapse-section.open .collapse-header {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  padding: 4px 0 8px;
  user-select: none;
  border-bottom: 1px solid #2a2a3e;
  margin-bottom: 4px;
}

/* 大图预览弹窗 */
.image-preview-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.8);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
  cursor: zoom-out;
}
.image-preview-large {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 0 30px rgba(0,0,0,0.6);
  cursor: zoom-out;
}
.image-preview-close {
  position: fixed;
  top: 20px; right: 30px;
  font-size: 28px;
  color: #fff;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}
.image-preview-close:hover { opacity: 1; }

/* ⭐ 帧间继承指示条 */
.frame-inherit-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  margin: 4px 0 8px;
  background: #f0f7ff;
  border: 1px solid #d0e5ff;
  border-radius: 6px;
  font-size: 12px;
}
.frame-inherit-label {
  color: #1a73e8;
  font-weight: 600;
  white-space: nowrap;
}
.frame-inherit-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  border: 2px solid #1a73e8;
  cursor: pointer;
  transition: transform 0.15s;
}
.frame-inherit-thumb:hover {
  transform: scale(1.1);
}
.frame-inherit-desc {
  color: #1a73e8;
  font-size: 11px;
  background: #dce8ff;
  padding: 1px 6px;
  border-radius: 4px;
}
</style>
