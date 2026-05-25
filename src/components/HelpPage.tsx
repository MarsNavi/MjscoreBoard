import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import { User } from '../lib/types';

interface HelpPageProps {
  user: User;
  onBack: () => void;
}

export default function HelpPage({ onBack }: HelpPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50">
      <div className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 text-white py-6 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold">版本更新</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-8">

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-orange-100">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v1.5.1</h2>
                <p className="text-sm text-gray-500">2026-05-25</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">更新内容：</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  <strong className="text-gray-900">对局明细支持长图分享：</strong>在对局详情页新增“分享对局明细”按钮，可一键生成设计感十足的对局详情长图。长图支持中文局名自动转换（如“东一局”）、领奖台式竞技名次徽章（金/银/铜）以及细致的和牌自摸/点炮/放铳情况的色彩高亮展示，支持原生系统分享及网页下载。
                </li>
                <li>
                  <strong className="text-gray-900">修复返回首页：</strong>计分页点按返回首页并确认后，能够正确回到首页。
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-orange-100">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v1.4</h2>
                <p className="text-sm text-gray-500">2026-05-08</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">更新内容：</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  <strong className="text-gray-900">成绩统计支持长图分享：</strong>在成绩统计页新增分享按钮，可生成包含战绩一览、攻守数据和和牌数据的长图，方便赛后保存和转发。
                </li>
                <li>
                  <strong className="text-gray-900">新增牌局档案切换：</strong>支持为不同牌友圈创建独立档案，也可以把别人分享的档案另存或合并。
                </li>
                <li>
                  <strong className="text-gray-900">新增牌局档案分享：</strong>可以把当前档案直接分享给其他人，对方可导入成新档案，也可以合并到自己的档案里。
                </li>
                <li>
                  <strong className="text-gray-900">修正同名选手统计：</strong>自动清理名字前后的空格，避免同一个人因为输入差异被拆成多条统计记录。
                </li>
                <li>
                  <strong className="text-gray-900">优化硬件计分牌中文显示：</strong>统一使用完整中文字体资源，修复部分计分牌中文字显示成方框的问题。
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-orange-100">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v1.3</h2>
                <p className="text-sm text-gray-500">2026-02-07</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">更新内容：</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  <strong className="text-gray-900">修复成绩统计：</strong>修正标准分计算逻辑，历史数据统计更准确。
                </li>
                <li>
                  <strong className="text-gray-900">新增和牌统计：</strong>增加和牌数、番数分布、最大番等统计。
                </li>
                <li>
                  <strong className="text-gray-900">优化硬件计分牌：</strong>改进硬件计分牌的连接与显示体验。
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-rose-100">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v1.2</h2>
                <p className="text-sm text-gray-500">2026-01-21</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">更新内容：</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  <strong className="text-gray-900">小屏适配优化：</strong>优化了在小屏设备上的显示效果，确保所有功能按钮都能在屏幕内完整显示，操作更加便捷。
                </li>
                <li>
                  <strong className="text-gray-900">流程简化：</strong>取消了“确认成绩”环节，和牌或流局后直接生效，让比赛节奏更加流畅。
                </li>
                <li>
                  <strong className="text-gray-900">智能硬件支持：</strong>支持蓝牙绑定认证的自研 BLE 计分设备，实现“一人一屏”的专属显示与交互体验。
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-purple-100">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v1.0</h2>
                <p className="text-sm text-gray-500">2026-01-16</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">v1.0 正式发布：</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  所有记录和统计均在本地运行，不需要联网也可以使用
                </li>
                <li>
                  支持牌局档案分享、导入和备份，方便换设备或与牌友同步记录
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-emerald-100">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v0.6</h2>
                <p className="text-sm text-gray-500">2026-01-14</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">更新内容：</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  <strong className="text-gray-900">快速开局智能记忆：</strong>开局时自动读取上次比赛的名称和选手名单，无需重复输入。
                </li>
                <li>
                  <strong className="text-gray-900">选手输入优化：</strong>常用选手列表更稳定，开局时可快速选择历史姓名。
                </li>
                <li>
                  <strong className="text-gray-900">比赛历史改进：</strong>历史页支持查看比赛结果，并提供近 24 小时小计，方便结算。
                </li>
                <li>
                  <strong className="text-gray-900">成绩统计优化：</strong>在成绩统计中增加攻守数据，统计和牌、自摸和放铳情况。
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-blue-100">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Play size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">v0.5</h2>
                <p className="text-sm text-gray-500">2025-11-17</p>
              </div>
            </div>
            <div className="pl-13 space-y-6 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">主要功能：</p>

              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-sm mr-2">1</span>
                    如何开局
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-8 text-sm">
                    <li>填写比赛名称（可选）</li>
                    <li>填写四位选手姓名（东、南、西、北）</li>
                    <li>点按“开始比赛”，创建 16 盘国标麻将比赛</li>
                    <li>系统自动进行座位轮换</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-sm mr-2">2</span>
                    如何计分
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-8 text-sm">
                    <li>和牌选手点按“和”录入番数</li>
                    <li>支持自摸和点炮两种情况</li>
                    <li>系统自动计算分数变化</li>
                    <li>第 16 盘结束后自动保存比赛成绩</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600 text-sm mr-2">3</span>
                    荒庄和裁判判罚
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-8 text-sm">
                    <li>荒庄时点按“荒庄”</li>
                    <li>支持裁判判罚功能（加分/扣分）</li>
                    <li>可处理错和、诈和等违规情况</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-sm mr-2">4</span>
                    比赛历史管理
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-8 text-sm">
                    <li>查看所有比赛记录</li>
                    <li>继续未完成的比赛</li>
                    <li>自动恢复比赛进度和分数</li>
                    <li>查看完整的比赛详情</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-100 text-pink-600 text-sm mr-2">5</span>
                    成绩统计功能
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-8 text-sm">
                    <li>查看所有已完成比赛的战绩</li>
                    <li>选手数据统计分析</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center space-y-2 text-sm text-gray-500">
              <p>本应用由四川熊猫俱乐部赞助</p>
              <p>作者 李睿 13501165270（微信同号）</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
