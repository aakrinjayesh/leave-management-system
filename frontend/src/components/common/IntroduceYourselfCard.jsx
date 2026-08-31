import { useEffect, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import Button from "./Button";
import TextArea from "./TextArea";
import Alert from "./Alert";
import Spinner from "./Spinner";
import * as profileApi from "../../api/profile.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "../../styles/dashboardShared.css";

// Keys MUST match backend INTRO_PROMPT_KEYS (utils/constants.js).
const INTRO_PROMPTS = [
  {
    key: "about",
    label: "About me",
    placeholder: "A short introduction - where you're from, your background, what makes you, you.",
  },
  {
    key: "jobLove",
    label: "What I love about my job",
    placeholder: "The parts of your work you enjoy the most.",
  },
  {
    key: "outsideWork",
    label: "Outside of work",
    placeholder: "Hobbies, interests, what you get up to on weekends.",
  },
];

const ANSWER_MAX = 2000;

// Private "Introduce yourself" card for the employee dashboard - a set of
// fixed prompts each of which the employee fills in with their own free text.
// Only ever visible to the employee themselves.
export default function IntroduceYourselfCard() {
  const [intro, setIntro] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    profileApi
      .getMyIntro()
      .then((data) => setIntro(data.intro))
      .catch((err) => setLoadError(getErrorMessage(err)));
  }, []);

  const answeredCount = intro
    ? INTRO_PROMPTS.filter((p) => (intro[p.key] || "").trim()).length
    : 0;

  const startEdit = (key) => {
    setEditingKey(key);
    setDraft(intro[key] || "");
    setSaveError("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraft("");
    setSaveError("");
  };

  const save = async (key) => {
    setSaving(true);
    setSaveError("");
    try {
      const data = await profileApi.updateMyIntro({ [key]: draft.trim() });
      setIntro(data.intro);
      cancelEdit();
    } catch (err) {
      setSaveError(getErrorMessage(err, "Couldn't save. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <div className="section-flex-row" style={{ marginBottom: 4 }}>
          <span className="card-section-title" style={{ marginBottom: 0 }}>
            Introduce yourself
          </span>
          {intro && (
            <span className="intro-progress">
              {answeredCount}/{INTRO_PROMPTS.length}
            </span>
          )}
        </div>
        <p className="card-section-subtitle">
          Tell us a little about yourself. Only you can see this.
        </p>

        {loadError && <Alert type="error">{loadError}</Alert>}

        {!intro && !loadError ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <Spinner size={22} />
          </div>
        ) : (
          intro && (
            <div className="intro-list">
              {INTRO_PROMPTS.map((prompt) => {
                const answer = (intro[prompt.key] || "").trim();
                const isEditing = editingKey === prompt.key;

                return (
                  <div key={prompt.key} className="intro-item">
                    <div className="intro-item-head">
                      <span className="intro-item-label">{prompt.label}</span>
                      {!isEditing &&
                        (answer ? (
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => startEdit(prompt.key)}
                          >
                            <Pencil size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                            Edit
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => startEdit(prompt.key)}
                          >
                            <Plus size={14} style={{ verticalAlign: "-2px", marginRight: 2 }} />
                            Add response
                          </button>
                        ))}
                    </div>

                    {isEditing ? (
                      <div className="intro-item-editor">
                        {saveError && <Alert type="error">{saveError}</Alert>}
                        <TextArea
                          rows={4}
                          maxLength={ANSWER_MAX}
                          placeholder={prompt.placeholder}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          autoFocus
                        />
                        <div className="intro-item-actions">
                          <Button
                            variant="secondary"
                            onClick={cancelEdit}
                            disabled={saving}
                            className="page-header-btn"
                          >
                            <X size={14} style={{ marginRight: 4 }} />
                            Cancel
                          </Button>
                          <Button
                            onClick={() => save(prompt.key)}
                            isLoading={saving}
                            className="page-header-btn"
                          >
                            <Check size={14} style={{ marginRight: 4 }} />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : answer ? (
                      <p className="intro-item-answer">{answer}</p>
                    ) : (
                      <p className="intro-item-empty">Not added yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
