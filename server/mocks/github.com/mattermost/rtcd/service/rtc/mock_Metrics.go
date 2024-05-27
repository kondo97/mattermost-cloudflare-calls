// Code generated by mockery v2.40.3. DO NOT EDIT.

package rtc

import mock "github.com/stretchr/testify/mock"

// MockMetrics is an autogenerated mock type for the Metrics type
type MockMetrics struct {
	mock.Mock
}

type MockMetrics_Expecter struct {
	mock *mock.Mock
}

func (_m *MockMetrics) EXPECT() *MockMetrics_Expecter {
	return &MockMetrics_Expecter{mock: &_m.Mock}
}

// DecRTCSessions provides a mock function with given fields: groupID
func (_m *MockMetrics) DecRTCSessions(groupID string) {
	_m.Called(groupID)
}

// MockMetrics_DecRTCSessions_Call is a *mock.Call that shadows Run/Return methods with type explicit version for method 'DecRTCSessions'
type MockMetrics_DecRTCSessions_Call struct {
	*mock.Call
}

// DecRTCSessions is a helper method to define mock.On call
//   - groupID string
func (_e *MockMetrics_Expecter) DecRTCSessions(groupID interface{}) *MockMetrics_DecRTCSessions_Call {
	return &MockMetrics_DecRTCSessions_Call{Call: _e.mock.On("DecRTCSessions", groupID)}
}

func (_c *MockMetrics_DecRTCSessions_Call) Run(run func(groupID string)) *MockMetrics_DecRTCSessions_Call {
	_c.Call.Run(func(args mock.Arguments) {
		run(args[0].(string))
	})
	return _c
}

func (_c *MockMetrics_DecRTCSessions_Call) Return() *MockMetrics_DecRTCSessions_Call {
	_c.Call.Return()
	return _c
}

func (_c *MockMetrics_DecRTCSessions_Call) RunAndReturn(run func(string)) *MockMetrics_DecRTCSessions_Call {
	_c.Call.Return(run)
	return _c
}

// DecRTPTracks provides a mock function with given fields: groupID, direction, trackType
func (_m *MockMetrics) DecRTPTracks(groupID string, direction string, trackType string) {
	_m.Called(groupID, direction, trackType)
}

// MockMetrics_DecRTPTracks_Call is a *mock.Call that shadows Run/Return methods with type explicit version for method 'DecRTPTracks'
type MockMetrics_DecRTPTracks_Call struct {
	*mock.Call
}

// DecRTPTracks is a helper method to define mock.On call
//   - groupID string
//   - direction string
//   - trackType string
func (_e *MockMetrics_Expecter) DecRTPTracks(groupID interface{}, direction interface{}, trackType interface{}) *MockMetrics_DecRTPTracks_Call {
	return &MockMetrics_DecRTPTracks_Call{Call: _e.mock.On("DecRTPTracks", groupID, direction, trackType)}
}

func (_c *MockMetrics_DecRTPTracks_Call) Run(run func(groupID string, direction string, trackType string)) *MockMetrics_DecRTPTracks_Call {
	_c.Call.Run(func(args mock.Arguments) {
		run(args[0].(string), args[1].(string), args[2].(string))
	})
	return _c
}

func (_c *MockMetrics_DecRTPTracks_Call) Return() *MockMetrics_DecRTPTracks_Call {
	_c.Call.Return()
	return _c
}

func (_c *MockMetrics_DecRTPTracks_Call) RunAndReturn(run func(string, string, string)) *MockMetrics_DecRTPTracks_Call {
	_c.Call.Return(run)
	return _c
}

// IncRTCConnState provides a mock function with given fields: state
func (_m *MockMetrics) IncRTCConnState(state string) {
	_m.Called(state)
}

// MockMetrics_IncRTCConnState_Call is a *mock.Call that shadows Run/Return methods with type explicit version for method 'IncRTCConnState'
type MockMetrics_IncRTCConnState_Call struct {
	*mock.Call
}

// IncRTCConnState is a helper method to define mock.On call
//   - state string
func (_e *MockMetrics_Expecter) IncRTCConnState(state interface{}) *MockMetrics_IncRTCConnState_Call {
	return &MockMetrics_IncRTCConnState_Call{Call: _e.mock.On("IncRTCConnState", state)}
}

func (_c *MockMetrics_IncRTCConnState_Call) Run(run func(state string)) *MockMetrics_IncRTCConnState_Call {
	_c.Call.Run(func(args mock.Arguments) {
		run(args[0].(string))
	})
	return _c
}

func (_c *MockMetrics_IncRTCConnState_Call) Return() *MockMetrics_IncRTCConnState_Call {
	_c.Call.Return()
	return _c
}

func (_c *MockMetrics_IncRTCConnState_Call) RunAndReturn(run func(string)) *MockMetrics_IncRTCConnState_Call {
	_c.Call.Return(run)
	return _c
}

// IncRTCErrors provides a mock function with given fields: groupID, errType
func (_m *MockMetrics) IncRTCErrors(groupID string, errType string) {
	_m.Called(groupID, errType)
}

// MockMetrics_IncRTCErrors_Call is a *mock.Call that shadows Run/Return methods with type explicit version for method 'IncRTCErrors'
type MockMetrics_IncRTCErrors_Call struct {
	*mock.Call
}

// IncRTCErrors is a helper method to define mock.On call
//   - groupID string
//   - errType string
func (_e *MockMetrics_Expecter) IncRTCErrors(groupID interface{}, errType interface{}) *MockMetrics_IncRTCErrors_Call {
	return &MockMetrics_IncRTCErrors_Call{Call: _e.mock.On("IncRTCErrors", groupID, errType)}
}

func (_c *MockMetrics_IncRTCErrors_Call) Run(run func(groupID string, errType string)) *MockMetrics_IncRTCErrors_Call {
	_c.Call.Run(func(args mock.Arguments) {
		run(args[0].(string), args[1].(string))
	})
	return _c
}

func (_c *MockMetrics_IncRTCErrors_Call) Return() *MockMetrics_IncRTCErrors_Call {
	_c.Call.Return()
	return _c
}

func (_c *MockMetrics_IncRTCErrors_Call) RunAndReturn(run func(string, string)) *MockMetrics_IncRTCErrors_Call {
	_c.Call.Return(run)
	return _c
}

// IncRTCSessions provides a mock function with given fields: groupID
func (_m *MockMetrics) IncRTCSessions(groupID string) {
	_m.Called(groupID)
}

// MockMetrics_IncRTCSessions_Call is a *mock.Call that shadows Run/Return methods with type explicit version for method 'IncRTCSessions'
type MockMetrics_IncRTCSessions_Call struct {
	*mock.Call
}

// IncRTCSessions is a helper method to define mock.On call
//   - groupID string
func (_e *MockMetrics_Expecter) IncRTCSessions(groupID interface{}) *MockMetrics_IncRTCSessions_Call {
	return &MockMetrics_IncRTCSessions_Call{Call: _e.mock.On("IncRTCSessions", groupID)}
}

func (_c *MockMetrics_IncRTCSessions_Call) Run(run func(groupID string)) *MockMetrics_IncRTCSessions_Call {
	_c.Call.Run(func(args mock.Arguments) {
		run(args[0].(string))
	})
	return _c
}

func (_c *MockMetrics_IncRTCSessions_Call) Return() *MockMetrics_IncRTCSessions_Call {
	_c.Call.Return()
	return _c
}

func (_c *MockMetrics_IncRTCSessions_Call) RunAndReturn(run func(string)) *MockMetrics_IncRTCSessions_Call {
	_c.Call.Return(run)
	return _c
}

// IncRTPTracks provides a mock function with given fields: groupID, direction, trackType
func (_m *MockMetrics) IncRTPTracks(groupID string, direction string, trackType string) {
	_m.Called(groupID, direction, trackType)
}

// MockMetrics_IncRTPTracks_Call is a *mock.Call that shadows Run/Return methods with type explicit version for method 'IncRTPTracks'
type MockMetrics_IncRTPTracks_Call struct {
	*mock.Call
}

// IncRTPTracks is a helper method to define mock.On call
//   - groupID string
//   - direction string
//   - trackType string
func (_e *MockMetrics_Expecter) IncRTPTracks(groupID interface{}, direction interface{}, trackType interface{}) *MockMetrics_IncRTPTracks_Call {
	return &MockMetrics_IncRTPTracks_Call{Call: _e.mock.On("IncRTPTracks", groupID, direction, trackType)}
}

func (_c *MockMetrics_IncRTPTracks_Call) Run(run func(groupID string, direction string, trackType string)) *MockMetrics_IncRTPTracks_Call {
	_c.Call.Run(func(args mock.Arguments) {
		run(args[0].(string), args[1].(string), args[2].(string))
	})
	return _c
}

func (_c *MockMetrics_IncRTPTracks_Call) Return() *MockMetrics_IncRTPTracks_Call {
	_c.Call.Return()
	return _c
}

func (_c *MockMetrics_IncRTPTracks_Call) RunAndReturn(run func(string, string, string)) *MockMetrics_IncRTPTracks_Call {
	_c.Call.Return(run)
	return _c
}

// ObserveRTPTracksWrite provides a mock function with given fields: groupID, trackType, dur
func (_m *MockMetrics) ObserveRTPTracksWrite(groupID string, trackType string, dur float64) {
	_m.Called(groupID, trackType, dur)
}

// MockMetrics_ObserveRTPTracksWrite_Call is a *mock.Call that shadows Run/Return methods with type explicit version for method 'ObserveRTPTracksWrite'
type MockMetrics_ObserveRTPTracksWrite_Call struct {
	*mock.Call
}

// ObserveRTPTracksWrite is a helper method to define mock.On call
//   - groupID string
//   - trackType string
//   - dur float64
func (_e *MockMetrics_Expecter) ObserveRTPTracksWrite(groupID interface{}, trackType interface{}, dur interface{}) *MockMetrics_ObserveRTPTracksWrite_Call {
	return &MockMetrics_ObserveRTPTracksWrite_Call{Call: _e.mock.On("ObserveRTPTracksWrite", groupID, trackType, dur)}
}

func (_c *MockMetrics_ObserveRTPTracksWrite_Call) Run(run func(groupID string, trackType string, dur float64)) *MockMetrics_ObserveRTPTracksWrite_Call {
	_c.Call.Run(func(args mock.Arguments) {
		run(args[0].(string), args[1].(string), args[2].(float64))
	})
	return _c
}

func (_c *MockMetrics_ObserveRTPTracksWrite_Call) Return() *MockMetrics_ObserveRTPTracksWrite_Call {
	_c.Call.Return()
	return _c
}

func (_c *MockMetrics_ObserveRTPTracksWrite_Call) RunAndReturn(run func(string, string, float64)) *MockMetrics_ObserveRTPTracksWrite_Call {
	_c.Call.Return(run)
	return _c
}

// NewMockMetrics creates a new instance of MockMetrics. It also registers a testing interface on the mock and a cleanup function to assert the mocks expectations.
// The first argument is typically a *testing.T value.
func NewMockMetrics(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockMetrics {
	mock := &MockMetrics{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}
