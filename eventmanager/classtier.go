package eventmanager

// Skill class tiers, mirroring Netkeiba-style grading (issue #3).
//
// Mirrors ts-legacy/eventmanager/classtier.ts. Values are byte-for-byte
// identical to the Prisma ClassTier enum.
type ClassTier string

const (
	ClassTierPreOp ClassTier = "PRE_OP"
	ClassTierOp    ClassTier = "OP"
	ClassTierG3    ClassTier = "G3"
	ClassTierG2    ClassTier = "G2"
	ClassTierG1    ClassTier = "G1"
)

// ClassTierOrder lists tiers from lowest to highest skill.
var ClassTierOrder = []ClassTier{
	ClassTierPreOp,
	ClassTierOp,
	ClassTierG3,
	ClassTierG2,
	ClassTierG1,
}

// ClassTierLabels holds human-readable labels (PRE_OP displays as "PRE-OP").
var ClassTierLabels = map[ClassTier]string{
	ClassTierPreOp: "PRE-OP",
	ClassTierOp:    "OP",
	ClassTierG3:    "G3",
	ClassTierG2:    "G2",
	ClassTierG1:    "G1",
}

func tierIndex(t ClassTier) int {
	for i, v := range ClassTierOrder {
		if v == t {
			return i
		}
	}
	return -1
}

// IsEligible reports whether a participant tier may enter an event with the
// given class restriction. Nil means unrestricted/unclassified.
//
// Eligibility rules (mirrors ts-legacy/eventmanager/classtier.ts isEligible):
//   - No restriction: anyone allowed.
//   - Same class: allowed.
//   - One class lower restriction: allowed.
//   - PRE_OP and OP normalize to unrestricted.
func IsEligible(participantTier, eventRestriction *ClassTier) bool {
	norm := func(t *ClassTier) *ClassTier {
		if t == nil {
			return nil
		}
		if *t == ClassTierPreOp || *t == ClassTierOp {
			return nil
		}
		return t
	}
	p, r := norm(participantTier), norm(eventRestriction)

	if r == nil {
		return true
	}
	if p == nil {
		return false
	}
	if *p == *r {
		return true
	}
	pIdx, rIdx := tierIndex(*p), tierIndex(*r)
	if pIdx == -1 || rIdx == -1 {
		return false
	}
	return rIdx == pIdx-1
}
