import { documentEventHandler } from "@sanity/functions";
import { createClient } from "@sanity/client";
//#region functions/complete-adjudication/index.ts
var API_VERSION = "2025-02-19";
var handler = documentEventHandler(async ({ context, event }) => {
	const { data } = event;
	const client = createClient({
		...context.clientOptions,
		apiVersion: API_VERSION
	});
	const log = (message, extra) => console.log(`[complete-adjudication] ${message}`, extra ?? "");
	/**
	* Write through `mutate`, never `patch`.
	*
	* `client.patch()` returns a lazy object in @sanity/client v8. Awaiting it here
	* logged "attached precedent to dispute" and changed nothing at all — the same
	* silent no-op that made an adjudication look successful while the dispute
	* stayed open. `mutate()` takes an array and returns a transaction result, so
	* either the write happened or the call threw.
	*
	* The transaction id is unique per invocation, not per document. A per-document
	* id looks like the right way to get idempotency, but Sanity remembers
	* transaction ids permanently: the second adjudication of the same dispute came
	* back as `transactionAlreadyExistsError`, and the function silently failed
	* forever after. Idempotency here comes from `createOrReplace` on a
	* date-keyed precedent id, which is naturally convergent — so the transaction
	* id only has to be unique.
	*/
	let attempt = 0;
	const write = (mutations) => {
		attempt += 1;
		const stamp = `${Date.now().toString(36)}-${attempt}`;
		const slug = data._id.replace(/[^a-zA-Z0-9_-]/g, "-");
		return client.mutate(mutations, { transactionId: `ca-${slug}-${stamp}`.slice(0, 128) });
	};
	let presenceKind = data.presenceKind;
	if (!presenceKind && data.presenceRule?._ref) {
		presenceKind = await client.fetch(`*[_id == $id][0].kind`, { id: data.presenceRule._ref }).catch(() => null) ?? void 0;
		if (presenceKind) log("resolved presence kind from the referenced rule", { presenceKind });
	}
	if (!presenceKind) {
		log("dispute is not about a presence kind; no precedent written", {
			id: data._id,
			subjectKind: data.subjectKind,
			territory: data.territory?._ref
		});
		return;
	}
	const decidedAt = data.ruling?.decidedAt ?? (/* @__PURE__ */ new Date()).toISOString();
	const from = decidedAt.slice(0, 10);
	const precedentId = `ninety.precedent.ruling-${presenceKind}-${from}`;
	const sources = ((data.presenceRule?._ref ? await client.fetch(`*[_id == $id][0]{"sources": sources[]{"_ref": _ref}}`, { id: data.presenceRule._ref }).catch(() => null) : null)?.sources ?? []).filter((s) => typeof s._ref === "string").map((s, i) => ({
		_type: "sourceRef",
		_key: `carried-${i}`,
		_ref: s._ref
	}));
	if (sources.length === 0) {
		log("presence rule has no sources; a precedent would be uncited, so stopping", {
			id: data._id,
			presenceKind
		});
		return;
	}
	const rationale = data.ruling?.rationale?.trim() || `Ruling on "${data.question ?? "a disputed presence"}" recorded against the dataset.`;
	const counts = data.ruling?.outcome === "counts";
	const precedent = {
		_id: precedentId,
		_type: "precedent",
		key: `ruling:${presenceKind}`,
		label: `Ruled: ${presenceKind.replace(/_/g, " ")} ${counts ? "counts" : "does not count"}`,
		subjectKind: "presence_kind",
		presenceKind,
		counted: counts,
		rationale,
		window: {
			_type: "effectiveWindow",
			from,
			to: null,
			note: "Scoped to future travel. Days already classified are not revisited."
		},
		decidedBy: data.ruling?.decidedBy?.trim() || "Unattributed",
		decidedAt,
		scope: data.ruling?.scope || "presence_kind",
		status: "active",
		sources
	};
	try {
		await client.createOrReplace(precedent);
		log("wrote precedent", {
			precedentId,
			from
		});
		const older = await client.fetch(`*[_type == "precedent" && presenceKind == $kind && status == "active" && _id != $id]._id`, {
			kind: presenceKind,
			id: precedentId
		});
		for (const id of older ?? []) try {
			await write([{ patch: {
				id,
				set: { status: "superseded" }
			} }]);
		} catch (error) {
			log("could not supersede an earlier ruling", {
				id,
				error: error.message
			});
		}
		if (older?.length) log("superseded earlier rulings", { count: older.length });
		await write([{ patch: {
			id: data._id,
			set: { precedent: {
				_type: "reference",
				_ref: precedentId
			} }
		} }]);
		log("attached precedent to dispute", { dispute: data._id });
	} catch (error) {
		console.error("[complete-adjudication] failed:", error);
	}
});
//#endregion
export { handler };

//# sourceMappingURL=index.js.map