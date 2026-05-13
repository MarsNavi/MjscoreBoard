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
                <h2 className="text-2xl font-bold text-gray-800">v1.4</h2>
                <p className="text-sm text-gray-500">2026-05-08</p>
              </div>
            </div>
            <div className="pl-13 space-y-3 text-gray-700 leading-relaxed">
              <p className="text-lg font-semibold text-gray-900">更新内容：</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  <strong className="text-gray-900">成绩统计支持长图分享：</strong>在成绩统计页新增分享按钮，可生成包含战绩一览、详细数据和和牌数据的长图，方便赛后保存和转发。
                </li>
                <li>
                  <strong className="text-gray-900">新增数据文件切换：</strong>支持为不同牌友圈创建独立数据文件，也可以把外部 JSON 打开为新数据文件，或合并到当前数据文件。
                </li>
                <li>
                  <strong className="text-gray-900">修正同名选手统计：</strong>自动清理名字前后的空格，避免同一个人因为输入差异被拆成多条统计记录。
                </li>
                <li>
                  <strong className="text-gray-900">优化硬件计分牌中文显示：</strong>统一使用完整中文字体资源，降低部分设备中文字显示成方框的概率。
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
                  <strong className="text-gray-900">修正了成绩统计中的bug：</strong>修复了标准分计算逻辑，解决了历史数据计算错误的问题。
                </li>
                <li>
                  <strong className="text-gray-900">增加了和牌数据统计：</strong>在战绩详情中新增了和牌数据的多维统计（和牌数、番数分布、最大番等）。
                </li>
                <li>
                  <strong className="text-gray-900">优化了硬件计分牌的体验：</strong>改进了与硬件记分牌的交互体验。
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
              <p className="text-lg font-semibold text-gray-900">v1.0正式发布：</p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>
                  所有的记录和数据统计均在本地运行，不需要联网也可以使用
                </li>
                <li>
                  支持数据的导入导出，方便切换设备或数据备份
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
                  <strong className="text-gray-900">选手输入优化：</strong>修复了常用选手名字显示问题，点击输入框可正确显示历史常用选手供快速选择。
                </li>
                <li>
                  <strong className="text-gray-900">比赛历史改进：</strong>在比赛页面历史上可以快速查看历史比赛结果，并且有查询当日的小计便于当日结算。
                </li>
                <li>
                  <strong className="text-gray-900">成绩统计优化：</strong>在成绩统计中增加了详细数据的展示，统计了和牌、自摸和放铳的情况。
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
                    <li>填写比赛名称（选填）</li>
                    <li>输入四位选手的姓名（东、南、西、北）</li>
                    <li>点击"开始比赛"创建16盘国标麻将比赛</li>
                    <li>系统自动进行座位轮换</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-sm mr-2">2</span>
                    如何计分
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-8 text-sm">
                    <li>和牌选手点击"和"按钮录入分数</li>
                    <li>支持自摸和点炮两种情况</li>
                    <li>系统自动计算分数变化</li>
                    <li>比赛结束后需所有选手确认成绩</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-gray-900 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600 text-sm mr-2">3</span>
                    荒庄和裁判判罚
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-8 text-sm">
                    <li>流局时可点击"荒庄"按钮</li>
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
              <p>本程序由四川熊猫俱乐部赞助</p>
              <p>作者 李睿 13501165270（微信同号）</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
