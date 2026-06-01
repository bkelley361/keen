export type RuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "lt"
  | "gt"
  | "lte"
  | "gte"
  | "regex";

export interface Rule {
  field: string;
  operator: RuleOperator;
  value: string;
  not?: boolean;
}

export interface RuleGroup {
  logic: "AND" | "OR";
  rules: Array<Rule | RuleGroup>;
  not?: boolean;
}

export type RuleContext = Record<string, string | number | undefined>;

function evaluateRule(rule: Rule, context: RuleContext): boolean {
  const raw = context[rule.field];
  const contextValue = raw !== undefined ? String(raw) : "";
  const ruleValue = rule.value;

  let result: boolean;

  switch (rule.operator) {
    case "equals":
      result = contextValue === ruleValue;
      break;
    case "not_equals":
      result = contextValue !== ruleValue;
      break;
    case "contains":
      result = contextValue.toLowerCase().includes(ruleValue.toLowerCase());
      break;
    case "not_contains":
      result = !contextValue.toLowerCase().includes(ruleValue.toLowerCase());
      break;
    case "lt":
      result = parseFloat(contextValue) < parseFloat(ruleValue);
      break;
    case "gt":
      result = parseFloat(contextValue) > parseFloat(ruleValue);
      break;
    case "lte":
      result = parseFloat(contextValue) <= parseFloat(ruleValue);
      break;
    case "gte":
      result = parseFloat(contextValue) >= parseFloat(ruleValue);
      break;
    case "regex": {
      try {
        result = new RegExp(ruleValue).test(contextValue);
      } catch {
        result = false;
      }
      break;
    }
    default:
      result = false;
  }

  return rule.not ? !result : result;
}

function isRuleGroup(item: Rule | RuleGroup): item is RuleGroup {
  return "logic" in item && "rules" in item;
}

export function evaluateRules(group: RuleGroup, context: RuleContext): boolean {
  let result: boolean;

  if (group.logic === "AND") {
    result = group.rules.every((item) =>
      isRuleGroup(item) ? evaluateRules(item, context) : evaluateRule(item, context)
    );
  } else {
    result = group.rules.some((item) =>
      isRuleGroup(item) ? evaluateRules(item, context) : evaluateRule(item, context)
    );
  }

  return group.not ? !result : result;
}
