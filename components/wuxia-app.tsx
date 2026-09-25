"use client";
import { contentPack } from "@/lib/content-pack";
import {DATA_REVISION} from "@/lib/catalog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  RefreshCw,
  UserRound,
  Users,
  WifiOff,
  X,
  Swords,
  LayoutDashboard,
} from "lucide-react";
import { AppContext, useAppState } from "./app-context";
import { RulesHelp } from "./rules-help";
import { Builder } from "./builder";
import { CharacterView } from "./character";
import { Choice } from "./common";
import { EntryDetail, Library } from "./library";
import { TeamView } from "./team";
import { InitiativeBoard } from "./initiative-board";
import { HostConsole } from "./host-console";
import { WebMCP } from "./webmcp";
export default function WuxiaApp() {
  const a = useAppState();
  return (
    <AppContext.Provider value={a}>
      <div className="app-shell">
        <header className="masthead">
          <button
            className="brand"
            onClick={() => {
              a.select("");
              a.setView("角色");
            }}
            aria-label="侠界之旅首页"
          >
            <span className="seal">侠</span>
            <span>
              侠界之旅<small>行侠手记</small>
            </span>
          </button>
          <div className="identity">
            <Choice
              label="当前操作角色"
              value={a.selected}
              onChange={a.select}
              options={[
                { value: "", label: "选择侠士" },
                ...(a.campaign?.characters ?? []).map((x) => ({
                  value: x.id,
                  label:
                    x.build.name + (x.build.kind === "npc" ? " · NPC" : ""),
                })),
              ]}
            />
            <button
              className={"button subtle " + (a.dm ? "active-choice" : "")}
              onClick={() => {
                a.setDm(!a.dm);
                if (!a.dm) a.setView("主持台");
                else if (a.view === "主持台") a.setView("角色");
              }}
            >
              <Users size={16} />
              {a.dm ? "主持人 · 退出" : "DM 主持台"}
            </button>
          </div>
        </header>
        <Tabs value={a.view} onValueChange={a.setView}>
          <div className="nav-wrap">
            <TabsList className="main-nav" variant="line">
              {[
                { v: "角色", Icon: UserRound },
                { v: "资料库", Icon: BookOpen },
                { v: "队伍", Icon: Users },
                { v: "先攻", Icon: Swords },
                ...(a.dm ? [{ v: "主持台", Icon: LayoutDashboard }] : []),
              ].map(({ v, Icon }) => (
                <TabsTrigger value={v} key={v}>
                  <Icon size={18} />
                  {v}
                </TabsTrigger>
              ))}
            </TabsList>
            <span className="sync-label">
              <i className={a.online ? "online" : "offline"} />
              {a.loading
                ? "连接中"
                : a.online
                  ? "共享存档已连接"
                  : "离线草稿模式"}
            </span>
          </div>
          {!a.online && (
            <div className="connection-bar" role="status">
              <WifiOff size={16} />
              <span>
                暂时无法连接共享存档。仍可浏览最近数据、编辑草稿；恢复连接后可保存。
              </span>
              <button onClick={() => a.refresh()}>
                <RefreshCw size={15} />
                重试
              </button>
            </div>
          )}
          {a.error && (
            <div className="global-message error" role="alert">
              <span>{a.error}</span>
              <button aria-label="关闭提示" onClick={() => a.setError("")}>
                <X size={18} />
              </button>
            </div>
          )}
          {a.notice && (
            <div className="global-message success" role="status">
              <span>{a.notice}</span>
              <button aria-label="关闭提示" onClick={() => a.setNotice("")}>
                <X size={18} />
              </button>
            </div>
          )}
          {[
            { name: "角色", component: <CharacterView key={a.selected} /> },
            { name: "资料库", component: <Library /> },
            { name: "队伍", component: <TeamView /> },
            { name: "先攻", component: <InitiativeBoard /> },
            { name: "主持台", component: <HostConsole /> },
          ].map((x) => (
            <TabsContent
              key={x.name}
              value={x.name}
              forceMount
              className={a.view !== x.name ? "hidden" : ""}
            >
              <main className="workspace">{x.component}</main>
            </TabsContent>
          ))}
        </Tabs>
        <Builder />
        <EntryDetail />
        <WebMCP />
        <footer>
          <RulesHelp className="text-button footer-help" />
          <span>
            {contentPack.title} · {contentPack.rulesVersion} · 资料修订 {DATA_REVISION}
          </span>
        </footer>
      </div>
    </AppContext.Provider>
  );
}
