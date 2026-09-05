package eventmanager

import (
	"reflect"
	"testing"
)

func tierPtr(t ClassTier) *ClassTier { return &t }

// Test_classTiers mirrors ts-legacy/eventmanager/classtier.test.ts.
func Test_classTiers(t *testing.T) {
	t.Run("ordered from PRE-OP up to G1", func(t *testing.T) {
		want := []ClassTier{"PRE_OP", "OP", "G3", "G2", "G1"}
		if !reflect.DeepEqual(ClassTierOrder, want) {
			t.Errorf("ClassTierOrder = %v, want %v", ClassTierOrder, want)
		}
	})

	t.Run("PRE_OP renders with a hyphen", func(t *testing.T) {
		if ClassTierLabels[ClassTierPreOp] != "PRE-OP" {
			t.Errorf("label = %q, want PRE-OP", ClassTierLabels[ClassTierPreOp])
		}
	})
}

func Test_isEligible(t *testing.T) {
	cases := []struct {
		name        string
		participant *ClassTier
		restriction *ClassTier
		want        bool
	}{
		{"open accepts unclassified", nil, nil, true},
		{"open accepts graded", tierPtr(ClassTierG2), nil, true},
		{"G1 enters G1", tierPtr(ClassTierG1), tierPtr(ClassTierG1), true},
		{"G1 enters G2", tierPtr(ClassTierG1), tierPtr(ClassTierG2), true},
		{"G1 blocked from G3", tierPtr(ClassTierG1), tierPtr(ClassTierG3), false},
		{"G1 enters OP (unrestricted)", tierPtr(ClassTierG1), tierPtr(ClassTierOp), true},
		{"G1 enters PRE_OP (unrestricted)", tierPtr(ClassTierG1), tierPtr(ClassTierPreOp), true},
		{"G2 enters G2", tierPtr(ClassTierG2), tierPtr(ClassTierG2), true},
		{"G2 enters G3", tierPtr(ClassTierG2), tierPtr(ClassTierG3), true},
		{"G2 blocked from G1", tierPtr(ClassTierG2), tierPtr(ClassTierG1), false},
		{"G2 enters OP", tierPtr(ClassTierG2), tierPtr(ClassTierOp), true},
		{"G2 enters PRE_OP", tierPtr(ClassTierG2), tierPtr(ClassTierPreOp), true},
		{"G3 enters G3", tierPtr(ClassTierG3), tierPtr(ClassTierG3), true},
		{"G3 enters OP", tierPtr(ClassTierG3), tierPtr(ClassTierOp), true},
		{"G3 blocked from G2", tierPtr(ClassTierG3), tierPtr(ClassTierG2), false},
		{"G3 blocked from G1", tierPtr(ClassTierG3), tierPtr(ClassTierG1), false},
		{"G3 enters PRE_OP", tierPtr(ClassTierG3), tierPtr(ClassTierPreOp), true},
		{"PRE_OP enters PRE_OP", tierPtr(ClassTierPreOp), tierPtr(ClassTierPreOp), true},
		{"PRE_OP enters OP", tierPtr(ClassTierPreOp), tierPtr(ClassTierOp), true},
		{"PRE_OP blocked from G3", tierPtr(ClassTierPreOp), tierPtr(ClassTierG3), false},
		{"PRE_OP blocked from G2", tierPtr(ClassTierPreOp), tierPtr(ClassTierG2), false},
		{"PRE_OP blocked from G1", tierPtr(ClassTierPreOp), tierPtr(ClassTierG1), false},
		{"OP enters OP", tierPtr(ClassTierOp), tierPtr(ClassTierOp), true},
		{"OP enters PRE_OP", tierPtr(ClassTierOp), tierPtr(ClassTierPreOp), true},
		{"OP blocked from G3", tierPtr(ClassTierOp), tierPtr(ClassTierG3), false},
		{"OP blocked from G2", tierPtr(ClassTierOp), tierPtr(ClassTierG2), false},
		{"OP blocked from G1", tierPtr(ClassTierOp), tierPtr(ClassTierG1), false},
		{"null participant vs OP restriction", nil, tierPtr(ClassTierOp), true},
		{"null participant vs G3 restriction", nil, tierPtr(ClassTierG3), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsEligible(tc.participant, tc.restriction); got != tc.want {
				t.Errorf("IsEligible = %v, want %v", got, tc.want)
			}
		})
	}
}
