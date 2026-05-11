"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db, tx } from "@/lib/instant";
import { Navbar } from "@/components/navbar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TEMPLATES, TEMPLATE_CATEGORIES, type MonitorTemplate } from "@/lib/templates";
import { Search, ArrowRight, Globe, Lock, Trash2 } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  price: "Price",
  youtube: "YouTube",
  news: "News",
  sports: "Sports",
  tech: "Tech",
  jobs: "Jobs",
  other: "Other",
};

interface DbTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  isPublic: boolean;
  sourceType: string;
  type?: string;
  mode?: string;
  selector?: string;
  clickSelector?: string;
  urlPlaceholder?: string;
  feedUrl?: string;
  createdAt: number;
}

function BuiltinCard({ template }: { template: MonitorTemplate }) {
  const router = useRouter();

  function apply() {
    const params = new URLSearchParams();
    params.set("templateId", template.id);
    if (template.selector) params.set("selector", template.selector);
    if (template.clickSelector) params.set("clickSelector", template.clickSelector);
    params.set("name", template.name);
    params.set("type", template.type);
    params.set("mode", template.mode);
    router.push(`/monitors/new?${params.toString()}`);
  }

  return (
    <Card className="cursor-pointer transition-all hover:border-primary/60 group" onClick={apply}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{template.icon}</span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate">{template.name}</CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                  {CATEGORY_LABELS[template.category] ?? template.category}
                </Badge>
                <Badge variant={template.type === "youtube" ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
                  {template.type === "youtube" ? "YT" : "Web"}
                </Badge>
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors mt-0.5" />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <CardDescription className="text-xs leading-relaxed">{template.description}</CardDescription>
        {template.selector && (
          <p className="text-[10px] font-mono text-muted-foreground/50 mt-1.5 truncate">{template.selector}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DbTemplateCard({
  template,
  isOwner,
}: {
  template: DbTemplate;
  isOwner: boolean;
}) {
  const router = useRouter();

  function apply() {
    if (template.sourceType === "feed") {
      const params = new URLSearchParams();
      if (template.feedUrl) params.set("feedUrl", template.feedUrl);
      params.set("name", template.name);
      router.push(`/feeds/new?${params.toString()}`);
    } else {
      const params = new URLSearchParams();
      if (template.selector) params.set("selector", template.selector);
      if (template.clickSelector) params.set("clickSelector", template.clickSelector);
      params.set("name", template.name);
      if (template.type) params.set("type", template.type);
      if (template.mode) params.set("mode", template.mode);
      router.push(`/monitors/new?${params.toString()}`);
    }
  }

  function toggleVisibility(e: React.MouseEvent) {
    e.stopPropagation();
    db.transact(tx.monitorTemplates[template.id].update({ isPublic: !template.isPublic }));
  }

  function deleteTemplate(e: React.MouseEvent) {
    e.stopPropagation();
    db.transact(tx.monitorTemplates[template.id].delete());
  }

  return (
    <Card className="cursor-pointer transition-all hover:border-primary/60 group" onClick={apply}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{template.icon ?? "🌐"}</span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate">{template.name}</CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {template.category && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                    {CATEGORY_LABELS[template.category] ?? template.category}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                  {template.sourceType === "feed" ? "RSS" : template.type === "youtube" ? "YT" : "Web"}
                </Badge>
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors mt-0.5" />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {template.description && (
          <CardDescription className="text-xs leading-relaxed mb-2">{template.description}</CardDescription>
        )}
        {template.selector && (
          <p className="text-[10px] font-mono text-muted-foreground/50 mb-2 truncate">{template.selector}</p>
        )}
        {isOwner && (
          <div className="flex items-center gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={toggleVisibility}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 border transition-colors ${
                template.isPublic
                  ? "border-primary/40 text-primary hover:bg-primary/10"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {template.isPublic ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
              {template.isPublic ? "Public" : "Private"}
            </button>
            <button
              onClick={deleteTemplate}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors"
            >
              <Trash2 className="h-2.5 w-2.5" />
              Delete
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TemplatesPage() {
  const { user } = db.useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"public" | "mine">("public");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { data: allDbData } = db.useQuery({
    monitorTemplates: { $: { where: { isPublic: true } } },
  });

  const { data: myDbData } = db.useQuery(
    user ? { monitorTemplates: { $: { where: { userId: user.id } } } } : null
  );

  const publicDbTemplates = (allDbData?.monitorTemplates ?? []) as unknown as DbTemplate[];
  const myTemplates = (myDbData?.monitorTemplates ?? []) as unknown as DbTemplate[];

  const q = query.trim().toLowerCase();

  function matchesQuery(name: string, description = "", category = "") {
    return !q || name.toLowerCase().includes(q) || description.toLowerCase().includes(q) || category.toLowerCase().includes(q);
  }

  function matchesCategory(category = "") {
    return activeCategory === "all" || category === activeCategory;
  }

  const filteredBuiltins = TEMPLATES.filter(
    (t) => matchesQuery(t.name, t.description, t.category) && matchesCategory(t.category)
  );

  const filteredPublicDb = publicDbTemplates.filter(
    (t) => matchesQuery(t.name, t.description ?? "", t.category ?? "") && matchesCategory(t.category ?? "")
  );

  const filteredMine = myTemplates.filter(
    (t) => matchesQuery(t.name, t.description ?? "", t.category ?? "") && matchesCategory(t.category ?? "")
  );

  return (
    <div className="flex-1">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => router.push("/")}>
          ← Back
        </Button>
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Monitor Templates</h1>
          <p className="text-sm text-muted-foreground">Pick a template to pre-fill a new monitor or feed.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-5">
          {(["public", "mine"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "public" ? "Public" : "My Templates"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search templates..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {TEMPLATE_CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              className="text-xs h-7 px-3"
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </div>

        {/* Public tab */}
        {tab === "public" && (
          <>
            {filteredBuiltins.length === 0 && filteredPublicDb.length === 0 && (
              <p className="text-sm text-muted-foreground py-12 text-center">No templates match your search.</p>
            )}
            {filteredPublicDb.length > 0 && (
              <section className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Community</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPublicDb.map((t) => (
                    <DbTemplateCard key={t.id} template={t} isOwner={t.userId === user?.id} />
                  ))}
                </div>
              </section>
            )}
            {filteredBuiltins.length > 0 && (
              <section>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Built-in</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredBuiltins.map((t) => (
                    <BuiltinCard key={t.id} template={t} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* My Templates tab */}
        {tab === "mine" && (
          <>
            {filteredMine.length === 0 && (
              <div className="py-12 text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  {q ? "No templates match your search." : "You haven't saved any templates yet."}
                </p>
                {!q && (
                  <p className="text-xs text-muted-foreground/60">
                    After creating a monitor or feed, choose "Save as template".
                  </p>
                )}
              </div>
            )}
            {filteredMine.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMine.map((t) => (
                  <DbTemplateCard key={t.id} template={t} isOwner />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
